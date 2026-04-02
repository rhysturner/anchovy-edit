import React, { useState } from 'react'
import VideoUploader from './components/VideoUploader'
import VideoPreview from './components/VideoPreview'
import Timeline from './components/Timeline'
import ExportButton from './components/ExportButton'
import AutoEditPanel from './components/AutoEditPanel'
import ProcessingOverlay from './components/ProcessingOverlay'
import { useVideoStore } from './store/videoStore'

const App: React.FC = () => {
  const { videoUrl, reset } = useVideoStore()
  const [mode, setMode] = useState<'single' | 'auto'>('single')

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Processing overlay — shown while auto-edit is running */}
      <ProcessingOverlay />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">
            anchovy<span className="text-orange-500">edit</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {videoUrl && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New video
            </button>
          )}
          <span className="text-xs text-zinc-600 font-mono">v0.1.0</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {!videoUrl ? (
          /* Upload state */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-3">
                  Edit your video,{' '}
                  <span className="text-orange-500">right here.</span>
                </h1>
                <p className="text-zinc-400 text-lg">
                  Trim, preview, and export — all in your browser. No uploads to servers.
                </p>
              </div>

              {/* Mode tabs */}
              <div className="flex rounded-xl bg-zinc-800 p-1 mb-6">
                <button
                  onClick={() => setMode('single')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'single'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  Single Clip
                </button>
                <button
                  onClick={() => setMode('auto')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'auto'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                  AI Auto-Edit
                </button>
              </div>

              {mode === 'single' ? <VideoUploader /> : <AutoEditPanel />}
            </div>
          </div>
        ) : (
          /* Editor state */
          <div className="flex-1 flex flex-col gap-0">
            {/* Preview area */}
            <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950">
              <div className="w-full max-w-4xl">
                <VideoPreview />
              </div>
            </div>

            {/* Bottom panel */}
            <div className="bg-zinc-900 border-t border-zinc-800 p-4 flex flex-col gap-4">
              <Timeline />
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1" />
                <div className="w-64">
                  <ExportButton />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
