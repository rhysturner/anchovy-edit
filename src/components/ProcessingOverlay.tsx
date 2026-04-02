import React from 'react'
import { useVideoStore } from '../store/videoStore'

const ProcessingOverlay: React.FC = () => {
  const { isAutoEditing, autoEditProgress, autoEditStatus } = useVideoStore()

  if (!isAutoEditing) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-10 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl max-w-sm w-full mx-4">
        {/* Animated icon */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
            <svg className="w-9 h-9 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        </div>

        {/* Title & status */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Processing…</h2>
          <p className="text-zinc-400 mt-1 text-sm min-h-[1.25rem]">{autoEditStatus}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-600 transition-all duration-500 rounded-full"
              style={{ width: `${autoEditProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>FFmpeg.wasm</span>
            <span>{autoEditProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProcessingOverlay
