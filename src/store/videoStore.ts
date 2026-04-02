import { create } from 'zustand'

export interface Clip {
  id: string
  file: File
  url: string
  duration: number
}

export interface EditSegment {
  clipId: string
  inPoint: number
  outPoint: number
  beatStart: number
}

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
  // Auto-edit state
  clips: Clip[]
  audioFile: File | null
  audioUrl: string | null
  beats: number[]
  editMap: EditSegment[]
  isAutoEditing: boolean
  autoEditProgress: number
  autoEditStatus: string
  // Single-video actions
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
  // Auto-edit actions
  addClip: (clip: Clip) => void
  removeClip: (id: string) => void
  setAudioFile: (file: File | null, url: string | null) => void
  setBeats: (beats: number[]) => void
  setEditMap: (map: EditSegment[]) => void
  setIsAutoEditing: (editing: boolean) => void
  setAutoEditProgress: (progress: number) => void
  setAutoEditStatus: (status: string) => void
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
  clips: [],
  audioFile: null,
  audioUrl: null,
  beats: [],
  editMap: [],
  isAutoEditing: false,
  autoEditProgress: 0,
  autoEditStatus: '',
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
  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
  removeClip: (id) => set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),
  setAudioFile: (file, url) => set({ audioFile: file, audioUrl: url }),
  setBeats: (beats) => set({ beats }),
  setEditMap: (map) => set({ editMap: map }),
  setIsAutoEditing: (editing) => set({ isAutoEditing: editing }),
  setAutoEditProgress: (progress) => set({ autoEditProgress: progress }),
  setAutoEditStatus: (status) => set({ autoEditStatus: status }),
}))
