import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useStoryboardStore, StoryboardClip } from '../store/storyboardStore'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Seconds before the clip's trimEnd at which we treat the clip as "finished"
 * and switch to the next one.  A small lookahead prevents missing the boundary
 * due to `timeupdate` event granularity.
 */
const CLIP_BOUNDARY_TOLERANCE = 0.05

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`
}

/**
 * Given a global playback position on the storyboard timeline, find which clip
 * is active and the corresponding seek position within that clip's source.
 */
function resolvePosition(
  clips: StoryboardClip[],
  globalTime: number,
): { clipIndex: number; sourceTime: number } | null {
  let elapsed = 0
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const end = elapsed + clip.duration
    if (globalTime < end || i === clips.length - 1) {
      return { clipIndex: i, sourceTime: clip.trimStart + (globalTime - elapsed) }
    }
    elapsed = end
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StoryboardPreview — video preview player that plays the storyboard as a
 * single continuous timeline.
 *
 * - On every `onTimeUpdate` it checks whether the current clip has been fully
 *   played (reached its `trimEnd`).  When it does, it immediately switches the
 *   `<video>` `src` to the next clip and seeks to its `trimStart`.
 * - A `useEffect` watches `storyboardClips` — whenever the array changes
 *   (trim, reorder, add, remove) it recalculates the total duration and,
 *   if currently paused, snaps the playhead back to the start.
 * - Exposes `activeClipIndex` so the `<Storyboard>` can highlight the active
 *   card.
 */
interface StoryboardPreviewProps {
  onActiveClipChange?: (index: number) => void
}

const StoryboardPreview: React.FC<StoryboardPreviewProps> = ({ onActiveClipChange }) => {
  const { storyboardClips } = useStoryboardStore()
  const videoRef = useRef<HTMLVideoElement>(null)

  // ── Playback state ──────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [activeClipIndex, setActiveClipIndex] = useState(0)

  // Stable ref so callbacks always read the latest clips without re-registering
  const clipsRef = useRef(storyboardClips)
  useEffect(() => { clipsRef.current = storyboardClips }, [storyboardClips])

  // Track accumulated start time of the active clip for global time calculation
  const clipStartOffsetRef = useRef(0)

  // ── Recalculate timeline when storyboard changes ──────────────────────
  useEffect(() => {
    const total = storyboardClips.reduce((sum, c) => sum + c.duration, 0)
    setTotalDuration(total)

    // Pause and reset to start when the clip list is modified
    const v = videoRef.current
    if (v && !v.paused) {
      v.pause()
      setIsPlaying(false)
    }
    setGlobalTime(0)
    setActiveClipIndex(0)
    clipStartOffsetRef.current = 0

    if (storyboardClips.length > 0) {
      const first = storyboardClips[0]
      if (v) {
        v.src = first.fileUrl
        v.currentTime = first.trimStart
      }
    } else if (v) {
      v.removeAttribute('src')
      v.load()
    }
    // Reset when clips change so we start fresh from the first clip
  }, [storyboardClips])

  // ── Load first clip when clips become non-empty (initial add) ─────────
  useEffect(() => {
    if (storyboardClips.length === 1) {
      const v = videoRef.current
      const first = storyboardClips[0]
      if (v) {
        v.src = first.fileUrl
        v.currentTime = first.trimStart
      }
    }
  }, [storyboardClips.length, storyboardClips])

  // ── onTimeUpdate: advance global time and switch clips ────────────────
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const clips = clipsRef.current

    // Find which clip is currently loaded
    const srcUrl = v.src
    const idx = clips.findIndex((c) => c.fileUrl === srcUrl || v.src.endsWith(c.fileUrl))
    if (idx === -1) return
    const clip = clips[idx]

    const gt = clipStartOffsetRef.current + (v.currentTime - clip.trimStart)
    setGlobalTime(gt)

    if (activeClipIndex !== idx) {
      setActiveClipIndex(idx)
      onActiveClipChange?.(idx)
    }

    // Has the clip reached its trim out-point?
    if (v.currentTime >= clip.trimEnd - CLIP_BOUNDARY_TOLERANCE) {
      const nextIdx = idx + 1
      if (nextIdx < clips.length) {
        // Switch to next clip
        const nextClip = clips[nextIdx]
        // Accumulate the start offset of the new clip
        clipStartOffsetRef.current += clip.duration
        v.src = nextClip.fileUrl
        v.currentTime = nextClip.trimStart
        setActiveClipIndex(nextIdx)
        onActiveClipChange?.(nextIdx)
        v.play().catch(() => {})
      } else {
        // End of storyboard
        v.pause()
        setIsPlaying(false)
        setGlobalTime(totalDuration)
      }
    }
  }, [activeClipIndex, onActiveClipChange, totalDuration])

  // ── Play / pause ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v || storyboardClips.length === 0) return

    if (isPlaying) {
      v.pause()
      setIsPlaying(false)
    } else {
      // If we are at or past the end, restart from the beginning
      if (globalTime >= totalDuration - CLIP_BOUNDARY_TOLERANCE) {
        clipStartOffsetRef.current = 0
        setGlobalTime(0)
        setActiveClipIndex(0)
        const first = storyboardClips[0]
        v.src = first.fileUrl
        v.currentTime = first.trimStart
      }
      v.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [isPlaying, globalTime, totalDuration, storyboardClips])

  // ── Scrub by clicking the progress bar ───────────────────────────────
  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (storyboardClips.length === 0 || totalDuration === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const targetGlobal = ratio * totalDuration

      const resolved = resolvePosition(storyboardClips, targetGlobal)
      if (!resolved) return
      const { clipIndex, sourceTime } = resolved

      // Calculate accumulated offset for that clip
      let offset = 0
      for (let i = 0; i < clipIndex; i++) offset += storyboardClips[i].duration
      clipStartOffsetRef.current = offset

      const v = videoRef.current
      if (!v) return
      const clip = storyboardClips[clipIndex]
      v.src = clip.fileUrl
      v.currentTime = Math.min(sourceTime, clip.trimEnd)
      setGlobalTime(targetGlobal)
      setActiveClipIndex(clipIndex)
      onActiveClipChange?.(clipIndex)
    },
    [storyboardClips, totalDuration, onActiveClipChange],
  )

  // ── Render ────────────────────────────────────────────────────────────
  if (storyboardClips.length === 0) return null

  const progressPct = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Video element */}
      <div
        className="relative w-full bg-black rounded-xl overflow-hidden flex items-center justify-center"
        style={{ aspectRatio: '16/9' }}
      >
        <video
          ref={videoRef}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            // handled in onTimeUpdate — this fires only if onTimeUpdate missed the boundary
            const v = videoRef.current
            const clips = clipsRef.current
            const srcUrl = v?.src ?? ''
            const idx = clips.findIndex((c) => c.fileUrl === srcUrl)
            const nextIdx = idx + 1
            if (nextIdx < clips.length && v) {
              const nextClip = clips[nextIdx]
              clipStartOffsetRef.current += clips[idx]?.duration ?? 0
              v.src = nextClip.fileUrl
              v.currentTime = nextClip.trimStart
              setActiveClipIndex(nextIdx)
              onActiveClipChange?.(nextIdx)
              v.play().catch(() => {})
            } else {
              setIsPlaying(false)
              setGlobalTime(totalDuration)
            }
          }}
          playsInline
        />
        {/* Play/pause overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black/20 transition-colors group"
          aria-label={isPlaying ? 'Pause' : 'Play storyboard'}
        >
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </button>
        {/* Clip index badge */}
        {storyboardClips.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/60 rounded px-2 py-0.5 text-xs font-mono text-zinc-300">
            {activeClipIndex + 1} / {storyboardClips.length}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 w-full px-1">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 transition-colors text-white flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress bar (clickable scrubber) */}
        <div
          className="flex-1 h-2 bg-zinc-800 rounded-full cursor-pointer overflow-hidden"
          onClick={handleScrub}
          title="Click to seek"
        >
          <div
            className="h-full bg-orange-500 rounded-full transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Timecode */}
        <div className="text-xs font-mono text-zinc-400 tabular-nums flex-shrink-0">
          <span className="text-white">{formatTime(globalTime)}</span>
          <span className="text-zinc-600 mx-1">/</span>
          {formatTime(totalDuration)}
        </div>
      </div>
    </div>
  )
}

export default StoryboardPreview
