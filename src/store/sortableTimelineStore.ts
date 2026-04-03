import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single clip in the linear sequence.
 *
 * `start` and `end` are source in/out points (seconds) within the clip's own
 * video file.  The clip's *timeline* position is NOT stored here — it is
 * always derived by summing the durations of all preceding clips:
 *
 *   timelineStart = Σ (clip[i].end − clip[i].start)  for i < index
 */
export interface SequenceClip {
  id: string
  videoUrl: string
  label: string
  /** Source in-point (seconds). */
  start: number
  /** Source out-point (seconds). */
  end: number
  /** Tailwind-compatible hex colour used to tint the filmstrip. */
  color: string
}

export type PaceSetting = 'slow' | 'balanced' | 'fast'

export const PACE_DURATIONS: Record<PaceSetting, number> = {
  slow: 4,
  balanced: 2.5,
  fast: 1.5,
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SortableTimelineState {
  sequence: SequenceClip[]
  pace: PaceSetting
  syncToBeats: boolean

  addClip: (url: string, label: string, sourceDuration: number) => void
  removeClip: (id: string) => void
  /**
   * Move the clip at `fromIndex` to `toIndex` (array-style reorder).
   * The timeline ripples automatically because positions are derived.
   */
  reorderClips: (fromIndex: number, toIndex: number) => void
  /**
   * Update a clip's source in/out points.
   * Automatically clamps to a minimum 0.1 s duration.
   */
  updateClip: (id: string, updates: Partial<Pick<SequenceClip, 'start' | 'end'>>) => void
  /**
   * Change the global pace setting.
   * Ripples ALL clips to the new default duration (preserving source in-point).
   */
  setPace: (pace: PaceSetting) => void
  setSyncToBeats: (v: boolean) => void
}

const CLIP_COLORS = [
  '#f97316', '#8b5cf6', '#06b6d4', '#10b981',
  '#ec4899', '#f59e0b', '#84cc16', '#3b82f6',
]

let _colorIdx = 0

export const useSortableTimelineStore = create<SortableTimelineState>()(
  immer((set) => ({
    // Seed demo clips (no real video) so the UI is non-empty on first load.
    sequence: [
      { id: 'demo-1', videoUrl: '', label: 'Clip 1', start: 0, end: 2.5, color: '#f97316' },
      { id: 'demo-2', videoUrl: '', label: 'Clip 2', start: 0, end: 2.5, color: '#8b5cf6' },
      { id: 'demo-3', videoUrl: '', label: 'Clip 3', start: 0, end: 2.5, color: '#06b6d4' },
    ],
    pace: 'balanced',
    syncToBeats: false,

    addClip: (url, label, sourceDuration) =>
      set((state) => {
        const paceDur = PACE_DURATIONS[state.pace]
        const end = Math.min(paceDur, sourceDuration)
        state.sequence.push({
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          videoUrl: url,
          label,
          start: 0,
          end: Math.max(0.1, end),
          color: CLIP_COLORS[_colorIdx++ % CLIP_COLORS.length],
        })
      }),

    removeClip: (id) =>
      set((state) => {
        const clip = state.sequence.find((c) => c.id === id)
        // Revoke the object URL to free browser memory.
        if (clip?.videoUrl) {
          try { URL.revokeObjectURL(clip.videoUrl) } catch { /* ignore */ }
        }
        state.sequence = state.sequence.filter((c) => c.id !== id)
      }),

    reorderClips: (fromIndex, toIndex) =>
      set((state) => {
        if (fromIndex === toIndex) return
        const [item] = state.sequence.splice(fromIndex, 1)
        state.sequence.splice(toIndex, 0, item)
      }),

    updateClip: (id, updates) =>
      set((state) => {
        const clip = state.sequence.find((c) => c.id === id)
        if (!clip) return
        if (updates.start !== undefined) clip.start = Math.max(0, updates.start)
        if (updates.end !== undefined) clip.end = updates.end
        // Enforce minimum 0.1 s duration
        if (clip.end - clip.start < 0.1) {
          if (updates.end !== undefined) clip.end = clip.start + 0.1
          else clip.start = clip.end - 0.1
        }
      }),

    setPace: (pace) =>
      set((state) => {
        state.pace = pace
        const dur = PACE_DURATIONS[pace]
        // Ripple all clips: preserve source in-point, extend/shrink out-point.
        state.sequence.forEach((clip) => {
          clip.end = clip.start + dur
        })
      }),

    setSyncToBeats: (v) =>
      set((state) => {
        state.syncToBeats = v
      }),
  })),
)

// ─── Derived helpers (pure functions, not stored) ─────────────────────────────

/**
 * Returns the timeline start position (seconds) for the clip at `index`.
 *
 *   timelineStart(i) = Σ duration(clip[j])  for j = 0..i-1
 */
export function getTimelineStart(sequence: SequenceClip[], index: number): number {
  return sequence.slice(0, index).reduce((sum, c) => sum + (c.end - c.start), 0)
}

/** Sum of all clip durations — the total sequence length. */
export function getTotalDuration(sequence: SequenceClip[]): number {
  return sequence.reduce((sum, c) => sum + (c.end - c.start), 0)
}

/**
 * Snap `time` to the nearest beat timestamp within `snapThreshold` seconds.
 * Returns `time` unchanged if no beat is close enough.
 */
export function snapToNearestBeat(time: number, beats: number[], snapThreshold = 0.15): number {
  if (beats.length === 0) return time
  let closest = beats[0]
  let minDist = Math.abs(time - beats[0])
  for (const b of beats) {
    const d = Math.abs(time - b)
    if (d < minDist) {
      minDist = d
      closest = b
    }
  }
  return minDist <= snapThreshold ? closest : time
}
