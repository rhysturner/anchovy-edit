import React, { useCallback, useRef } from 'react'
import { useVideoStore, Clip } from '../store/videoStore'
import { useAutoEdit } from '../hooks/useAutoEdit'

const SUPPORTED_VIDEO_MIME = /video\/(mp4|quicktime)/

/** Resolves the duration of a video file via a temporary HTMLVideoElement. */
function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(video.duration)
    video.onerror = () => reject(new Error('Could not read video metadata'))
    video.src = url
  })
}

const AutoEditPanel: React.FC = () => {
  const { clips, audioFile, beats, addClip, removeClip, setAudioFile } = useVideoStore()
  const { runAutoEdit } = useAutoEdit()

  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleVideoFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        if (!file.type.match(SUPPORTED_VIDEO_MIME)) continue
        const url = URL.createObjectURL(file)
        let duration = 0
        try {
          duration = await getVideoDuration(url)
        } catch {
          duration = 0
        }
        const clip: Clip = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          url,
          duration,
        }
        addClip(clip)
      }
    },
    [addClip],
  )

  const handleAudioFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('audio/') && !file.name.toLowerCase().endsWith('.mp3')) {
        alert('Please upload an MP3 audio file.')
        return
      }
      const url = URL.createObjectURL(file)
      setAudioFile(file, url)
    },
    [setAudioFile],
  )

  const canEdit = clips.length > 0 && audioFile !== null

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ── Clips ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Video Clips ({clips.length})
        </h2>

        <div
          className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 rounded-xl p-6 cursor-pointer transition-colors"
          onClick={() => videoInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files.length) handleVideoFiles(e.dataTransfer.files)
          }}
        >
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleVideoFiles(e.target.files)}
          />
          <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm text-zinc-400">Add video clips (MP4 or MOV)</p>
          <p className="text-xs text-zinc-600 mt-1">Multiple files supported — drag & drop or click</p>
        </div>

        {clips.length > 0 && (
          <ul className="flex flex-col gap-2">
            {clips.map((clip, idx) => (
              <li
                key={clip.id}
                className="flex items-center gap-3 px-3 py-2 bg-zinc-800 rounded-lg"
              >
                <span className="text-xs font-mono text-orange-400 w-5 text-center select-none">
                  {idx + 1}
                </span>
                <svg
                  className="w-4 h-4 text-zinc-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  />
                </svg>
                <span className="text-sm text-zinc-300 flex-1 truncate">{clip.file.name}</span>
                <span className="text-xs font-mono text-zinc-500 flex-shrink-0">
                  {clip.duration > 0 ? `${clip.duration.toFixed(1)}s` : '—'}
                </span>
                <button
                  onClick={() => removeClip(clip.id)}
                  aria-label={`Remove ${clip.file.name}`}
                  className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Audio track ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Audio Track
        </h2>

        {audioFile ? (
          <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800 rounded-lg">
            <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="text-sm text-zinc-300 flex-1 truncate">{audioFile.name}</span>
            {beats.length > 0 && (
              <span className="text-xs font-mono text-green-400 flex-shrink-0">
                {beats.length} beats
              </span>
            )}
            <button
              onClick={() => setAudioFile(null, null)}
              aria-label="Remove audio track"
              className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 rounded-xl p-6 cursor-pointer transition-colors"
            onClick={() => audioInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleAudioFile(file)
            }}
          >
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAudioFile(file)
              }}
            />
            <svg className="w-8 h-8 text-zinc-600 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <p className="text-sm text-zinc-400">Add an audio track (MP3)</p>
            <p className="text-xs text-zinc-600 mt-1">Beat sync aligns cuts to the music</p>
          </div>
        )}

        {/* Beat visualizer strip */}
        {beats.length > 0 && (
          <BeatVisualizer beats={beats} />
        )}
      </section>

      {/* ── Magic Edit button ── */}
      <button
        onClick={runAutoEdit}
        disabled={!canEdit}
        className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all ${
          canEdit
            ? 'bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
        }`}
      >
        {/* Sparkles icon */}
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
        {canEdit
          ? 'Magic Edit'
          : clips.length === 0
          ? 'Add clips to get started'
          : 'Add an audio track to get started'}
      </button>
    </div>
  )
}

/** Renders detected beats as tick marks on a horizontal strip. */
function BeatVisualizer({ beats }: { beats: number[] }) {
  const maxTime = (beats[beats.length - 1] ?? 1) + 0.5

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-600">Detected beats</p>
      <div className="relative h-5 bg-zinc-800 rounded-md overflow-hidden">
        {beats.map((t, i) => (
          <div
            key={i}
            className="absolute top-0.5 bottom-0.5 w-px bg-orange-400/60 rounded-full"
            style={{ left: `${(t / maxTime) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export default AutoEditPanel
