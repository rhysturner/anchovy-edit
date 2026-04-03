import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryboardClip {
  /** Unique identifier. */
  id: string
  /** Object URL of the source video file. */
  fileUrl: string
  /** Original file name. */
  fileName: string
  /** Object URL of the generated thumbnail image (data URL or blob URL). */
  thumbnailUrl: string
  /** Trim in-point relative to the source file (seconds). */
  trimStart: number
  /** Trim out-point relative to the source file (seconds). */
  trimEnd: number
  /** Total duration of the source file (seconds). Used to clamp trim handles. */
  sourceDuration: number
  /**
   * Calculated playable duration = trimEnd − trimStart.
   * Kept as a derived field so consumers never have to re-compute it.
   */
  duration: number
}

// ─── Store State ──────────────────────────────────────────────────────────────

interface StoryboardState {
  storyboardClips: StoryboardClip[]

  /** Append a new clip (e.g. after file upload + thumbnail generation). */
  addClip: (clip: StoryboardClip) => void

  /** Remove a clip by id. */
  removeClip: (id: string) => void

  /**
   * Reorder the clip list given a new ordered array of ids.
   * Any ids not found in the current list are silently ignored.
   */
  reorderClips: (orderedIds: string[]) => void

  /**
   * Update trimStart / trimEnd for a clip and recalculate duration.
   * Both values are clamped to [0, sourceDuration].
   */
  updateClipTrim: (id: string, trimStart: number, trimEnd: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum playable clip duration (seconds). Clips cannot be trimmed shorter than this. */
const MIN_CLIP_DURATION = 0.1

export const useStoryboardStore = create<StoryboardState>()(
  immer((set) => ({
    storyboardClips: [],

    addClip: (clip) =>
      set((state) => {
        state.storyboardClips.push(clip)
      }),

    removeClip: (id) =>
      set((state) => {
        state.storyboardClips = state.storyboardClips.filter((c) => c.id !== id)
      }),

    reorderClips: (orderedIds) =>
      set((state) => {
        const map = new Map(state.storyboardClips.map((c) => [c.id, c]))
        state.storyboardClips = orderedIds.flatMap((id) => {
          const clip = map.get(id)
          return clip ? [clip] : []
        })
      }),

    updateClipTrim: (id, trimStart, trimEnd) =>
      set((state) => {
        const clip = state.storyboardClips.find((c) => c.id === id)
        if (!clip) return
        const safeStart = Math.max(0, Math.min(trimStart, clip.sourceDuration))
        const safeEnd = Math.max(safeStart + MIN_CLIP_DURATION, Math.min(trimEnd, clip.sourceDuration))
        clip.trimStart = parseFloat(safeStart.toFixed(3))
        clip.trimEnd = parseFloat(safeEnd.toFixed(3))
        clip.duration = parseFloat((safeEnd - safeStart).toFixed(3))
      }),
  })),
)
