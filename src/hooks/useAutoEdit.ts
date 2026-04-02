import { useCallback, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useVideoStore, Clip, EditSegment } from '../store/videoStore'

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
const TARGET_DURATION = 30 // seconds for the highlight reel
/** Safety margin (seconds) added to each segment's boundary to avoid overflow. */
const SEGMENT_END_BUFFER = 0.05

/**
 * Detects beat onsets in an audio file using energy-based onset detection
 * via the Web Audio API. Returns an array of timestamps (seconds).
 */
async function detectBeats(audioFile: File): Promise<number[]> {
  const arrayBuffer = await audioFile.arrayBuffer()

  const audioContext = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  } finally {
    await audioContext.close()
  }

  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const frameSize = 1024
  const hopSize = 512

  // Calculate RMS energy per hop frame
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize)
  const energies = new Float32Array(numFrames)
  for (let i = 0; i < numFrames; i++) {
    const offset = i * hopSize
    let sum = 0
    for (let j = 0; j < frameSize; j++) {
      const s = channelData[offset + j]
      sum += s * s
    }
    energies[i] = Math.sqrt(sum / frameSize)
  }

  // Onset strength: positive first-order difference of energy
  const onsetStrength = new Float32Array(numFrames)
  let maxStrength = 0
  for (let i = 1; i < numFrames; i++) {
    onsetStrength[i] = Math.max(0, energies[i] - energies[i - 1])
    if (onsetStrength[i] > maxStrength) maxStrength = onsetStrength[i]
  }

  if (maxStrength === 0) return []

  for (let i = 0; i < numFrames; i++) {
    onsetStrength[i] /= maxStrength
  }

  // Peak-pick above threshold with minimum inter-beat interval of 250 ms
  const threshold = 0.35
  const minInterBeatFrames = Math.ceil((0.25 * sampleRate) / hopSize)
  const beats: number[] = []
  let lastPeakFrame = -minInterBeatFrames

  for (let i = 1; i < numFrames - 1; i++) {
    if (
      onsetStrength[i] > threshold &&
      onsetStrength[i] > onsetStrength[i - 1] &&
      onsetStrength[i] >= onsetStrength[i + 1] &&
      i - lastPeakFrame >= minInterBeatFrames
    ) {
      beats.push(parseFloat(((i * hopSize) / sampleRate).toFixed(3)))
      lastPeakFrame = i
    }
  }

  return beats
}

/**
 * Maps video clip segments onto beat intervals to build a 30-second edit map.
 * Clips are cycled in order; each segment's in-point is chosen randomly.
 */
export function generateEditMap(
  clips: Clip[],
  beats: number[],
  targetDuration = TARGET_DURATION,
): EditSegment[] {
  if (clips.length === 0 || beats.length < 2) return []

  const segments: EditSegment[] = []
  let totalTime = 0
  let clipIndex = 0

  for (let i = 0; i < beats.length - 1 && totalTime < targetDuration; i++) {
    const beatStart = beats[i]
    const rawDuration = beats[i + 1] - beats[i]
    const segDuration = Math.min(rawDuration, targetDuration - totalTime)

    const clip = clips[clipIndex % clips.length]
    clipIndex++

    const safeMax = clip.duration - segDuration - SEGMENT_END_BUFFER
    if (safeMax < 0) {
      // Clip too short — clamp to whatever is available
      const clampedDuration = Math.min(segDuration, clip.duration - SEGMENT_END_BUFFER)
      if (clampedDuration <= 0) continue
      segments.push({ clipId: clip.id, inPoint: 0, outPoint: parseFloat(clampedDuration.toFixed(3)), beatStart })
      totalTime += clampedDuration
      continue
    }

    const inPoint = safeMax > 0 ? Math.random() * safeMax : 0
    segments.push({
      clipId: clip.id,
      inPoint: parseFloat(inPoint.toFixed(3)),
      outPoint: parseFloat((inPoint + segDuration).toFixed(3)),
      beatStart,
    })
    totalTime += segDuration
  }

  return segments
}

/**
 * Builds the FFmpeg command string that would produce the highlight reel.
 * Each segment is trimmed to a numbered file, then all are joined with the
 * concat demuxer. Returns the full argument list for documentation purposes.
 */
export function buildFfmpegCommandString(segments: EditSegment[], clips: Clip[]): string {
  const clipById = new Map(clips.map((c) => [c.id, c]))
  const lines: string[] = ['# Step 1 — trim each beat-aligned segment']

  segments.forEach((seg, i) => {
    const clip = clipById.get(seg.clipId)
    const ext = clip?.file.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
    const inputName = `clip_${seg.clipId}.${ext}`
    const dur = (seg.outPoint - seg.inPoint).toFixed(3)
    lines.push(
      `ffmpeg -ss ${seg.inPoint.toFixed(3)} -t ${dur} -i ${inputName} -c:v libx264 -preset ultrafast -an seg_${i}.mp4`,
    )
  })

  lines.push('')
  lines.push('# Step 2 — concatenate all segments')
  lines.push(`# concat.txt contains: ${segments.map((_, i) => `file 'seg_${i}.mp4'`).join(', ')}`)
  lines.push('ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4')

  return lines.join('\n')
}

/**
 * Assembles the edit map into a single MP4 using ffmpeg.wasm.
 * Calls onProgress(0–1) as each segment is encoded.
 */
async function assembleFfmpeg(
  segments: EditSegment[],
  clips: Clip[],
  onProgress: (p: number) => void,
): Promise<Blob> {
  const ffmpeg = new FFmpeg()
  const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
  await ffmpeg.load({ coreURL, wasmURL })

  const clipById = new Map(clips.map((c) => [c.id, c]))
  const writtenClips = new Set<string>()

  // Write each unique clip file to the ffmpeg virtual filesystem
  for (const clipId of new Set(segments.map((s) => s.clipId))) {
    const clip = clipById.get(clipId)
    if (!clip) continue
    const ext = clip.file.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
    await ffmpeg.writeFile(`clip_${clipId}.${ext}`, await fetchFile(clip.file))
    writtenClips.add(clipId)
  }

  // Trim each segment into its own numbered file
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const clip = clipById.get(seg.clipId)
    if (!clip) continue
    const ext = clip.file.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
    const dur = (seg.outPoint - seg.inPoint).toFixed(3)

    await ffmpeg.exec([
      '-ss', seg.inPoint.toFixed(3),
      '-t', dur,
      '-i', `clip_${seg.clipId}.${ext}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-an',
      `seg_${i}.mp4`,
    ])

    onProgress((i + 1) / segments.length)
  }

  // Write the concat manifest
  const concatLines = segments.map((_, i) => `file 'seg_${i}.mp4'`).join('\n')
  await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatLines))

  // Concatenate all segments into the final output
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    'output.mp4',
  ])

  const data = await ffmpeg.readFile('output.mp4')
  return new Blob([data as BlobPart], { type: 'video/mp4' })
}

/**
 * Hook that orchestrates the full AI Auto-Edit pipeline:
 *   1. Beat detection (Web Audio API)
 *   2. Edit-map generation
 *   3. FFmpeg.wasm assembly
 *   4. Sets the resulting video as the active preview
 */
export function useAutoEdit() {
  const {
    clips,
    audioFile,
    setBeats,
    setEditMap,
    setIsAutoEditing,
    setAutoEditProgress,
    setAutoEditStatus,
    setVideoFile,
    setVideoUrl,
  } = useVideoStore()

  const abortRef = useRef(false)

  const runAutoEdit = useCallback(async () => {
    if (!audioFile || clips.length === 0) return

    abortRef.current = false
    setIsAutoEditing(true)
    setAutoEditProgress(0)
    setAutoEditStatus('Analyzing audio for beats…')

    try {
      // 1. Beat detection
      const detectedBeats = await detectBeats(audioFile)
      if (abortRef.current) return
      setBeats(detectedBeats)
      setAutoEditProgress(20)

      if (detectedBeats.length < 2) {
        setAutoEditStatus('Not enough beats detected — try a different audio file.')
        return
      }

      // 2. Edit-map generation
      setAutoEditStatus('Generating beat-aligned edit map…')
      const editMapSegments = generateEditMap(clips, detectedBeats)
      if (abortRef.current) return
      setEditMap(editMapSegments)
      setAutoEditProgress(30)

      if (editMapSegments.length === 0) {
        setAutoEditStatus('Could not build edit map — clips may be too short.')
        return
      }

      // 3. FFmpeg assembly
      setAutoEditStatus('Assembling highlight reel with FFmpeg…')
      const outputBlob = await assembleFfmpeg(editMapSegments, clips, (p) => {
        if (!abortRef.current) setAutoEditProgress(30 + Math.round(p * 65))
      })
      if (abortRef.current) return

      // 4. Publish result
      setAutoEditProgress(95)
      setAutoEditStatus('Finalizing…')
      const outputUrl = URL.createObjectURL(outputBlob)
      const outputFile = new File([outputBlob], 'magic-edit.mp4', { type: 'video/mp4' })
      setVideoFile(outputFile)
      setVideoUrl(outputUrl)
      setAutoEditProgress(100)
      setAutoEditStatus('Done!')
    } catch (err) {
      console.error('[useAutoEdit] error:', err)
      const hint =
        err instanceof Error && err.message
          ? err.message
          : 'Ensure video files are valid MP4/MOV and the audio file is MP3.'
      setAutoEditStatus(`Error: ${hint}`)
    } finally {
      setIsAutoEditing(false)
    }
  }, [
    audioFile,
    clips,
    setBeats,
    setEditMap,
    setIsAutoEditing,
    setAutoEditProgress,
    setAutoEditStatus,
    setVideoFile,
    setVideoUrl,
  ])

  return { runAutoEdit }
}
