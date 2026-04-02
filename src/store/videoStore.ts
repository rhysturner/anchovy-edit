import { create } from 'zustand'

interface VideoState {
  videoFile: File | null
  videoUrl: string | null
  duration: number
  currentTime: number
  trimStart: number
  trimEnd: number
  isPlaying: boolean
  isProcessing: boolean
  progress: number
  setVideoFile: (file: File) => void
  setVideoUrl: (url: string) => void
  setDuration: (duration: number) => void
  setCurrentTime: (time: number) => void
  setTrimStart: (time: number) => void
  setTrimEnd: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setIsProcessing: (processing: boolean) => void
  setProgress: (progress: number) => void
  reset: () => void
}

export const useVideoStore = create<VideoState>((set) => ({
  videoFile: null,
  videoUrl: null,
  duration: 0,
  currentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  isPlaying: false,
  isProcessing: false,
  progress: 0,
  setVideoFile: (file) => set({ videoFile: file }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setDuration: (duration) => set({ duration, trimEnd: duration }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTrimStart: (time) => set({ trimStart: time }),
  setTrimEnd: (time) => set({ trimEnd: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setProgress: (progress) => set({ progress }),
  reset: () =>
    set({
      videoFile: null,
      videoUrl: null,
      duration: 0,
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      isPlaying: false,
      isProcessing: false,
      progress: 0,
    }),
}))
