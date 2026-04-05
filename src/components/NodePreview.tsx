import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useGraphToTimeline, TimelineClip } from '../hooks/useGraphToTimeline'
import { useNodeEditorStore } from '../store/nodeEditorStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIP_BOUNDARY_TOLERANCE = 0.05

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`
}

function resolvePosition(
  timeline: TimelineClip[],
  globalTime: number,
): { clipIndex: number; sourceTime: number } | null {
  for (let i = 0; i < timeline.length; i++) {
    const clip = timeline[i]
    const end = clip.globalStart + clip.duration
    if (globalTime < end || i === timeline.length - 1) {
      return { clipIndex: i, sourceTime: clip.trimStart + (globalTime - clip.globalStart) }
    }
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

const NodePreview: React.FC = () => {
  const timeline = useGraphToTimeline()
  const { setActiveNodeId, setPreviewTime } = useNodeEditorStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [activeClipIndex, setActiveClipIndex] = useState(0)

  const timelineRef = useRef(timeline)
  useEffect(() => { timelineRef.current = timeline }, [timeline])

  const clipStartOffsetRef = useRef(0)

  // ── Recalculate when timeline changes ─────────────────────────────────
  useEffect(() => {
    const total = timeline.reduce((sum, c) => sum + c.duration, 0)
    setTotalDuration(total)

    const v = videoRef.current
    if (v && !v.paused) {
      v.pause()
      setIsPlaying(false)
    }
    setGlobalTime(0)
    setActiveClipIndex(0)
    clipStartOffsetRef.current = 0
    setActiveNodeId(null)
    setPreviewTime(0)

    if (timeline.length > 0) {
      const first = timeline[0]
      if (v) {
        v.src = first.fileUrl
        v.currentTime = first.trimStart
      }
    } else if (v) {
      v.removeAttribute('src')
      v.load()
    }
  }, [timeline, setActiveNodeId, setPreviewTime])

  // ── onTimeUpdate ──────────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const clips = timelineRef.current

    const srcUrl = v.src
    const idx = clips.findIndex(
      (c) => srcUrl === c.fileUrl || srcUrl.endsWith(c.fileUrl),
    )
    if (idx === -1) return
    const clip = clips[idx]

    const gt = clipStartOffsetRef.current + (v.currentTime - clip.trimStart)
    setGlobalTime(gt)
    setPreviewTime(gt)

    if (activeClipIndex !== idx) {
      setActiveClipIndex(idx)
      setActiveNodeId(clip.nodeId)
    }

    if (v.currentTime >= clip.trimEnd - CLIP_BOUNDARY_TOLERANCE) {
      const nextIdx = idx + 1
      if (nextIdx < clips.length) {
        const nextClip = clips[nextIdx]
        clipStartOffsetRef.current += clip.duration
        v.src = nextClip.fileUrl
        v.currentTime = nextClip.trimStart
        setActiveClipIndex(nextIdx)
        setActiveNodeId(nextClip.nodeId)
        v.play().catch(() => {})
      } else {
        v.pause()
        setIsPlaying(false)
        setGlobalTime(totalDuration)
        setPreviewTime(totalDuration)
        setActiveNodeId(null)
      }
    }
  }, [activeClipIndex, totalDuration, setActiveNodeId, setPreviewTime])

  // ── Play / pause ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v || timeline.length === 0) return

    if (isPlaying) {
      v.pause()
      setIsPlaying(false)
    } else {
      if (globalTime >= totalDuration - CLIP_BOUNDARY_TOLERANCE) {
        clipStartOffsetRef.current = 0
        setGlobalTime(0)
        setActiveClipIndex(0)
        const first = timeline[0]
        v.src = first.fileUrl
        v.currentTime = first.trimStart
      }
      v.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [isPlaying, globalTime, totalDuration, timeline])

  // ── Scrub ─────────────────────────────────────────────────────────────
  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (timeline.length === 0 || totalDuration === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const targetGlobal = ratio * totalDuration

      const resolved = resolvePosition(timeline, targetGlobal)
      if (!resolved) return
      const { clipIndex, sourceTime } = resolved

      clipStartOffsetRef.current = timeline[clipIndex].globalStart

      const v = videoRef.current
      if (!v) return
      const clip = timeline[clipIndex]
      v.src = clip.fileUrl
      v.currentTime = Math.min(sourceTime, clip.trimEnd)
      setGlobalTime(targetGlobal)
      setPreviewTime(targetGlobal)
      setActiveClipIndex(clipIndex)
      setActiveNodeId(clip.nodeId)
    },
    [timeline, totalDuration, setActiveNodeId, setPreviewTime],
  )

  // ── Render ────────────────────────────────────────────────────────────
  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-80 flex-shrink-0 bg-[#1a1a1a] border-r border-zinc-800 p-4 gap-3">
        <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <p className="text-xs text-zinc-500 text-center">No sequence connected</p>
      </div>
    )
  }

  const progressPct = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0

  return (
    <div className="flex flex-col w-80 flex-shrink-0 bg-[#1a1a1a] border-r border-zinc-800 p-3 gap-3">
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
            const v = videoRef.current
            const clips = timelineRef.current
            const srcUrl = v?.src ?? ''
            const idx = clips.findIndex(
              (c) => srcUrl === c.fileUrl || srcUrl.endsWith(c.fileUrl),
            )
            const nextIdx = idx + 1
            if (nextIdx < clips.length && v) {
              const nextClip = clips[nextIdx]
              clipStartOffsetRef.current += clips[idx]?.duration ?? 0
              v.src = nextClip.fileUrl
              v.currentTime = nextClip.trimStart
              setActiveClipIndex(nextIdx)
              setActiveNodeId(nextClip.nodeId)
              v.play().catch(() => {})
            } else {
              setIsPlaying(false)
              setGlobalTime(totalDuration)
              setPreviewTime(totalDuration)
              setActiveNodeId(null)
            }
          }}
          playsInline
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black/20 transition-colors group"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {!isPlaying && (
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </button>
        {timeline.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/60 rounded px-2 py-0.5 text-xs font-mono text-zinc-300">
            {activeClipIndex + 1} / {timeline.length}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-green-600 hover:bg-green-500 transition-colors text-white flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div
          className="flex-1 h-1.5 bg-zinc-800 rounded-full cursor-pointer overflow-hidden"
          onClick={handleScrub}
          title="Click to seek"
        >
          <div
            className="h-full bg-green-500 rounded-full transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="text-xs font-mono text-zinc-400 tabular-nums flex-shrink-0">
          <span className="text-white">{formatTime(globalTime)}</span>
          <span className="text-zinc-600 mx-1">/</span>
          {formatTime(totalDuration)}
        </div>
      </div>
    </div>
  )
}

export default NodePreview
