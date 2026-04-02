import React, { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useVideoStore } from '../store/videoStore'

const ExportButton: React.FC = () => {
  const { videoFile, trimStart, trimEnd, isProcessing, setIsProcessing, setProgress, progress } =
    useVideoStore()
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const formatSeconds = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = (s % 60).toFixed(3)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(6, '0')}`
  }

  const handleExport = async () => {
    if (!videoFile) return
    setError(null)
    setDone(false)
    setIsProcessing(true)
    setProgress(0)

    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg()
      }
      const ffmpeg = ffmpegRef.current

      if (!ffmpeg.loaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
      }

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100))
      })

      const inputName = videoFile.name.endsWith('.mov') ? 'input.mov' : 'input.mp4'
      const outputName = 'output.mp4'

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile))
      await ffmpeg.exec([
        '-i', inputName,
        '-ss', formatSeconds(trimStart),
        '-to', formatSeconds(trimEnd),
        '-c', 'copy',
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `anchovy-edit-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)

      setDone(true)
      setProgress(100)
    } catch (err) {
      console.error(err)
      setError('Export failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const trimDuration = trimEnd - trimStart

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
      {done && !isProcessing && (
        <p className="text-sm text-green-400 text-center">✓ Export complete!</p>
      )}
      {isProcessing && (
        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <button
        onClick={handleExport}
        disabled={!videoFile || isProcessing || trimDuration <= 0}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors w-full"
      >
        {isProcessing ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing… {progress}%
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Trim ({trimDuration > 0 ? `${trimDuration.toFixed(1)}s` : '—'})
          </>
        )}
      </button>
    </div>
  )
}

export default ExportButton
