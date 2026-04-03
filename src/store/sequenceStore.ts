import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Track Item Types (Recursive) ────────────────────────────────────────────

/** Shared fields for every item that lives on a sequence timeline. */
interface TrackItemBase {
  id: string
  label: string
  /** Position (seconds) of this item on the parent sequence's timeline. */
  startTime: number
  /** Visible duration (seconds) on the timeline. */
  duration: number
  /** How far into the source material this item begins (seconds). */
  sourceOffset: number
  /** Tailwind-compatible hex colour used to identify the clip. */
  color: string
}

/** Leaf node — a concrete media clip. */
export interface MediaClip extends TrackItemBase {
  kind: 'clip'
}

/** Branch node — references another Sequence to drill into. */
export interface SequenceItem extends TrackItemBase {
  kind: 'sequence'
  nestedSequenceId: string
}

/** Discriminated union of all track item variants. */
export type TrackItem = MediaClip | SequenceItem

/**
 * @deprecated Use TrackItem instead. This alias will be removed in v1.0.0.
 * Replace all `Slice` references with `TrackItem`.
 */
export type Slice = TrackItem

export interface Sequence {
  id: string
  label: string
  /** The ordered list of track items on this sequence. */
  slices: TrackItem[]
}

// ─── Store State ──────────────────────────────────────────────────────────────

interface SequenceState {
  sequences: Record<string, Sequence>
  /** Navigation history — last entry is the currently-viewed sequence. */
  navigationHistory: string[]
  /** Absolute source timestamp (seconds) being previewed while trimming, or null when idle. */
  trimPreviewTime: number | null
  /** Global playhead position (seconds) on the currently-viewed sequence timeline. */
  playheadTime: number

  addSequence: (sequence: Sequence) => void
  updateSlice: (sequenceId: string, sliceId: string, updates: Partial<TrackItem>) => void
  /**
   * Tail-trim a clip to `newDuration` and immediately ripple all subsequent
   * clips left or right so there are never any gaps (Magnetic Storyboard).
   */
  tailTrimSlice: (sequenceId: string, sliceId: string, newDuration: number) => void
  /**
   * Split a clip at `atTime` (absolute sequence seconds) into two clips.
   * The left clip retains the original id with "-a" suffix; the right gets "-b".
   * Does nothing when `atTime` is at or outside the clip's boundaries.
   */
  splitClip: (sequenceId: string, sliceId: string, atTime: number) => void
  pushNavigation: (sequenceId: string) => void
  popNavigation: () => void
  /** Jump directly to a sequence that is already in the history (truncates forward entries). */
  navigateTo: (sequenceId: string) => void
  setTrimPreviewTime: (time: number | null) => void
  setPlayheadTime: (time: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum clip duration (seconds). Clips cannot be trimmed shorter than this. */
const MIN_CLIP_DURATION = 0.1
/**
 * Minimum distance (seconds) from a clip boundary when splitting.
 * Prevents creating zero-length or near-zero-length clips at the edges.
 * Exported so UI components can apply the same guard when enabling the Split button.
 */
export const MIN_SPLIT_MARGIN = 0.05

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const ROOT_SEQUENCE_ID = 'root'

const INITIAL_ROOT_SLICES: TrackItem[] = [
  { kind: 'clip', id: 's1', label: 'Intro', startTime: 0, duration: 4, sourceOffset: 0, color: '#f97316' },
  {
    kind: 'sequence',
    id: 's2',
    label: 'Main Act',
    startTime: 4,
    duration: 8,
    sourceOffset: 2,
    color: '#8b5cf6',
    nestedSequenceId: 'seq-main',
  },
  { kind: 'clip', id: 's3', label: 'B-Roll', startTime: 12, duration: 4, sourceOffset: 0, color: '#06b6d4' },
  { kind: 'clip', id: 's4', label: 'Outro', startTime: 16, duration: 4, sourceOffset: 1, color: '#10b981' },
]

const INITIAL_NESTED_SLICES: TrackItem[] = [
  { kind: 'clip', id: 'n1', label: 'Shot A', startTime: 0, duration: 3, sourceOffset: 0, color: '#ec4899' },
  { kind: 'clip', id: 'n2', label: 'Shot B', startTime: 3, duration: 2.5, sourceOffset: 1, color: '#f59e0b' },
  { kind: 'clip', id: 'n3', label: 'Shot C', startTime: 5.5, duration: 2.5, sourceOffset: 0.5, color: '#84cc16' },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSequenceStore = create<SequenceState>()(
  immer((set) => ({
    sequences: {
      [ROOT_SEQUENCE_ID]: {
        id: ROOT_SEQUENCE_ID,
        label: 'Main Timeline',
        slices: INITIAL_ROOT_SLICES,
      },
      'seq-main': {
        id: 'seq-main',
        label: 'Main Act',
        slices: INITIAL_NESTED_SLICES,
      },
    },
    navigationHistory: [ROOT_SEQUENCE_ID],
    trimPreviewTime: null,
    playheadTime: 0,

    addSequence: (sequence) =>
      set((state) => {
        state.sequences[sequence.id] = sequence
      }),

    updateSlice: (sequenceId, sliceId, updates) =>
      set((state) => {
        const seq = state.sequences[sequenceId]
        if (!seq) return
        const idx = seq.slices.findIndex((s) => s.id === sliceId)
        if (idx === -1) return
        Object.assign(seq.slices[idx], updates)
      }),

    tailTrimSlice: (sequenceId, sliceId, newDuration) =>
      set((state) => {
        const seq = state.sequences[sequenceId]
        if (!seq) return
        const idx = seq.slices.findIndex((s) => s.id === sliceId)
        if (idx === -1) return
        const slice = seq.slices[idx]
        const safeNewDuration = Math.max(MIN_CLIP_DURATION, newDuration)
        const delta = safeNewDuration - slice.duration
        slice.duration = parseFloat(safeNewDuration.toFixed(3))
        // Ripple: shift every clip that comes after this one
        for (let i = idx + 1; i < seq.slices.length; i++) {
          seq.slices[i].startTime = parseFloat((seq.slices[i].startTime + delta).toFixed(3))
        }
      }),

    splitClip: (sequenceId, sliceId, atTime) =>
      set((state) => {
        const seq = state.sequences[sequenceId]
        if (!seq) return
        const idx = seq.slices.findIndex((s) => s.id === sliceId)
        if (idx === -1) return
        const clip = seq.slices[idx]
        const localTime = atTime - clip.startTime
        // Guard: split point must be strictly inside the clip
        if (localTime <= MIN_SPLIT_MARGIN || localTime >= clip.duration - MIN_SPLIT_MARGIN) return

        const leftClip: TrackItem = {
          ...clip,
          id: `${clip.id}-a`,
          duration: parseFloat(localTime.toFixed(3)),
        }
        const rightClip: TrackItem = {
          ...clip,
          id: `${clip.id}-b`,
          startTime: parseFloat(atTime.toFixed(3)),
          duration: parseFloat((clip.duration - localTime).toFixed(3)),
          sourceOffset: parseFloat((clip.sourceOffset + localTime).toFixed(3)),
        }

        seq.slices.splice(idx, 1, leftClip, rightClip)
      }),

    pushNavigation: (sequenceId) =>
      set((state) => {
        state.navigationHistory.push(sequenceId)
      }),

    popNavigation: () =>
      set((state) => {
        if (state.navigationHistory.length > 1) {
          state.navigationHistory.pop()
        }
      }),

    navigateTo: (sequenceId) =>
      set((state) => {
        const idx = state.navigationHistory.indexOf(sequenceId)
        if (idx !== -1) {
          state.navigationHistory.splice(idx + 1)
        }
      }),

    setTrimPreviewTime: (time) =>
      set((state) => {
        state.trimPreviewTime = time
      }),

    setPlayheadTime: (time) =>
      set((state) => {
        state.playheadTime = time
      }),
  })),
)
