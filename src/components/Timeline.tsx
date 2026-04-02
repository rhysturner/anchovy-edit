import React, { useRef, useCallback, useEffect } from 'react'
import { useVideoStore } from '../store/videoStore'

const Timeline: React.FC = () => {
  const { duration, currentTime, trimStart, trimEnd, beats, setCurrentTime, setTrimStart, setTrimEnd } =
    useVideoStore()
  const trackRef = useRef<HTMLDivElement>(null)

  const getTimeFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || duration === 0) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration],
  )

  const handleTrackClick = (e: React.MouseEvent) => {
    const time = getTimeFromX(e.clientX)
    setCurrentTime(time)
    const video = document.querySelector('video')
    if (video) video.currentTime = time
  }

  const isDraggingPlayhead = useRef(false)

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingPlayhead.current = true
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead.current) return
      const time = getTimeFromX(e.clientX)
      setCurrentTime(time)
      const video = document.querySelector('video')
      if (video) video.currentTime = time
    }
    const handleMouseUp = () => {
      isDraggingPlayhead.current = false
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [getTimeFromX, setCurrentTime])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const tickCount = Math.min(10, Math.max(5, Math.floor(duration)))
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * duration)

  if (duration === 0) return null

  const trimStartPct = (trimStart / duration) * 100
  const trimEndPct = (trimEnd / duration) * 100
  const playheadPct = (currentTime / duration) * 100

  return (
    <div className="flex flex-col gap-2 w-full px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="flex justify-between text-xs text-zinc-500 font-mono px-1">
        {ticks.map((t, i) => (
          <span key={i}>{formatTime(t)}</span>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 bg-zinc-800 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTrackClick}
      >
        {/* Trim region */}
        <div
          className="absolute top-0 h-full bg-orange-500/20 border-x-2 border-orange-500"
          style={{
            left: `${trimStartPct}%`,
            width: `${trimEndPct - trimStartPct}%`,
          }}
        />

        {/* Beat markers */}
        {beats.map((beat, i) => {
          const pct = (beat / duration) * 100
          if (pct > 100) return null
          return (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-yellow-400/30 pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          )
        })}

        {/* Video frames placeholder bars */}
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="absolute top-1 bottom-1 w-px bg-zinc-600"
            style={{ left: `${(i / 20) * 100}%` }}
          />
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white z-10 cursor-grab"
          style={{ left: `${playheadPct}%` }}
          onMouseDown={handlePlayheadMouseDown}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
        </div>
      </div>

      {/* Trim handles */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-zinc-500 w-16 flex-shrink-0">Trim Start</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={trimStart}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (v < trimEnd) setTrimStart(v)
            }}
            className="flex-1 accent-orange-500"
          />
          <span className="text-xs font-mono text-orange-400 w-16 text-right">
            {formatTime(trimStart)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-zinc-500 w-16 flex-shrink-0">Trim End</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={trimEnd}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (v > trimStart) setTrimEnd(v)
            }}
            className="flex-1 accent-orange-500"
          />
          <span className="text-xs font-mono text-orange-400 w-16 text-right">
            {formatTime(trimEnd)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default Timeline
