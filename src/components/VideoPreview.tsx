import React, { useEffect, useRef, useCallback } from 'react'
import { useVideoStore } from '../store/videoStore'
import { useSequenceStore } from '../store/sequenceStore'
import { getCurrentClip } from '../utils/sequenceUtils'

const VideoPreview: React.FC = () => {
  const {
    videoUrl,
    trimStart,
    trimEnd,
    isPlaying,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    currentTime,
  } = useVideoStore()

  const { trimPreviewTime, playheadTime, sequences, navigationHistory } = useSequenceStore()

  const videoRef = useRef<HTMLVideoElement>(null)

  // Stable refs so seek effects don't hold stale sequence data
  const sequencesRef = useRef(sequences)
  const navHistoryRef = useRef(navigationHistory)
  useEffect(() => { sequencesRef.current = sequences }, [sequences])
  useEffect(() => { navHistoryRef.current = navigationHistory }, [navigationHistory])

  // ── Seek: trim preview (highest priority) ─────────────────────────────────
  useEffect(() => {
    if (trimPreviewTime === null) return
    const v = videoRef.current
    if (v) v.currentTime = trimPreviewTime
  }, [trimPreviewTime])

  // ── Seek: global playhead scrubbing ───────────────────────────────────────
  // Fires when playheadTime changes OR when trimPreviewTime becomes null
  // (so we snap back to the playhead position after a trim drag ends).
  useEffect(() => {
    if (trimPreviewTime !== null) return // trim preview takes priority
    const v = videoRef.current
    if (!v) return
    const currentSeqId = navHistoryRef.current[navHistoryRef.current.length - 1]
    const seq = sequencesRef.current[currentSeqId]
    if (!seq) return
    const { internalTime } = getCurrentClip(seq.slices, playheadTime)
    v.currentTime = internalTime
  }, [playheadTime, trimPreviewTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart
      }
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying, trimStart, trimEnd])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    if (video.currentTime >= trimEnd) {
      video.pause()
      setIsPlaying(false)
      video.currentTime = trimStart
    }
  }, [trimEnd, trimStart, setCurrentTime, setIsPlaying])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration)
  }, [setDuration])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m}:${String(s).padStart(2, '0')}.${ms}`
  }

  if (!videoUrl) return null

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      <div className="relative w-full bg-black rounded-xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
        >
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </button>
      </div>
      <div className="flex items-center gap-4 w-full px-2">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 transition-colors text-white flex-shrink-0"
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
        <div className="text-sm font-mono text-zinc-400">
          <span className="text-white">{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  )
}

export default VideoPreview
