import React, { useCallback, useRef, useState } from 'react'
import { useVideoStore } from '../store/videoStore'

const VideoUploader: React.FC = () => {
  const { setVideoFile, setVideoUrl, reset } = useVideoStore()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.match(/video\/(mp4|quicktime)/)) {
        alert('Please upload an MP4 or MOV file.')
        return
      }
      reset()
      const url = URL.createObjectURL(file)
      setVideoFile(file)
      setVideoUrl(url)
    },
    [setVideoFile, setVideoUrl, reset],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-full min-h-[320px] border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
        isDragging
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-4 text-zinc-400 select-none">
        <svg
          className={`w-16 h-16 transition-colors ${isDragging ? 'text-orange-400' : 'text-zinc-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
          />
        </svg>
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-300">
            {isDragging ? 'Drop your video here' : 'Upload a video to edit'}
          </p>
          <p className="text-sm mt-1">Drag & drop or click to browse</p>
          <p className="text-xs mt-2 text-zinc-600">MP4 and MOV supported</p>
        </div>
      </div>
    </div>
  )
}

export default VideoUploader
