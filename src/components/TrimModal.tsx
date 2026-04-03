import React, { useRef, useEffect, useState, useCallback } from 'react'
import { StoryboardClip } from '../store/storyboardStore'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrimModalProps {
  clip: StoryboardClip
  onClose: () => void
  onDone: (trimStart: number, trimEnd: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TrimModal — full-source video preview with frame-accurate in/out trim sliders.
 *
 * The modal overlays the entire screen (fixed, z-50).  Clicking the backdrop
 * dismisses without saving.  "Done" commits the current trim values via
 * `onDone` and then closes.
 *
 * The active trim region is highlighted on a scrubber bar and the video
 * automatically seeks when either handle is moved.
 */
const TrimModal: React.FC<TrimModalProps> = ({ clip, onClose, onDone }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [trimStart, setTrimStart] = useState(clip.trimStart)
  const [trimEnd, setTrimEnd] = useState(clip.trimEnd)
  const [currentTime, setCurrentTime] = useState(clip.trimStart)
  const [isPlaying, setIsPlaying] = useState(false)

  // Seek video when trim handles move
  useEffect(() => {
    const v = videoRef.current
    if (v) v.currentTime = trimStart
  }, [trimStart])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.currentTime = trimEnd
  }, [trimEnd])

  // Enforce trim region during playback
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    if (v.currentTime >= trimEnd) {
      v.pause()
      v.currentTime = trimStart
      setIsPlaying(false)
    }
  }, [trimStart, trimEnd])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) {
      v.pause()
      setIsPlaying(false)
    } else {
      if (v.currentTime >= trimEnd || v.currentTime < trimStart) {
        v.currentTime = trimStart
      }
      v.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const handleDone = () => {
    onDone(trimStart, trimEnd)
    onClose()
  }

  const duration = clip.sourceDuration || 1
  const trimStartPct = (trimStart / duration) * 100
  const trimEndPct = (trimEnd / duration) * 100
  const playheadPct = (currentTime / duration) * 100

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl w-full max-w-2xl mx-4 flex flex-col gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-white">Trim Clip</h2>
            <p className="text-xs text-zinc-500 truncate max-w-[300px]" title={clip.fileName}>
              {clip.fileName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="relative bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            src={clip.fileUrl}
            className="max-w-full max-h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              const v = videoRef.current
              if (v) v.currentTime = trimStart
            }}
            onEnded={() => {
              setIsPlaying(false)
            }}
            playsInline
          />
          {/* Play/pause overlay */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black/20 transition-colors group"
            aria-label={isPlaying ? 'Pause' : 'Play trim region'}
          >
            {!isPlaying && (
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* Scrubber + trim controls */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Scrubber */}
          <div className="relative h-8 bg-zinc-800 rounded-lg overflow-hidden select-none">
            {/* Inactive regions (outside trim) */}
            <div className="absolute inset-0 bg-zinc-700/50" />
            {/* Trim region highlight */}
            <div
              className="absolute top-0 h-full bg-orange-500/30 border-x-2 border-orange-500"
              style={{ left: `${trimStartPct}%`, width: `${trimEndPct - trimStartPct}%` }}
            />
            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-0.5 bg-white z-10"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
            </div>
          </div>

          {/* Trim Start slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-20 flex-shrink-0">In Point</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.033}
              value={trimStart}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v < trimEnd - 0.1) setTrimStart(v)
              }}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs font-mono text-orange-400 w-16 text-right tabular-nums">
              {formatTime(trimStart)}
            </span>
          </div>

          {/* Trim End slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Out Point</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.033}
              value={trimEnd}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v > trimStart + 0.1) setTrimEnd(v)
              }}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs font-mono text-orange-400 w-16 text-right tabular-nums">
              {formatTime(trimEnd)}
            </span>
          </div>

          {/* Duration badge */}
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Clip duration:{' '}
              <span className="text-zinc-300 font-mono tabular-nums">
                {formatTime(trimEnd - trimStart)}
              </span>
            </span>
            <span>
              Source:{' '}
              <span className="font-mono tabular-nums">{formatTime(duration)}</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default TrimModal
