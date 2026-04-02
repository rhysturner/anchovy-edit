import { create } from 'zustand'

export interface Slice {
  id: string
  label: string
  /** Position (seconds) of this slice on the parent sequence's timeline. */
  startTime: number
  /** Visible duration (seconds) on the timeline. */
  duration: number
  /** How far into the source material this slice begins (seconds). */
  sourceOffset: number
  /** Tailwind-compatible hex colour used to identify the clip. */
  color: string
  /** If set, double-clicking this slice drills into the named sequence. */
  nestedSequenceId?: string
}

export interface Sequence {
  id: string
  label: string
  slices: Slice[]
}

interface SequenceState {
  sequences: Record<string, Sequence>
  /** Navigation stack — last entry is the currently-viewed sequence. */
  navigationStack: string[]

  addSequence: (sequence: Sequence) => void
  updateSlice: (sequenceId: string, sliceId: string, updates: Partial<Slice>) => void
  pushNavigation: (sequenceId: string) => void
  popNavigation: () => void
}

export const ROOT_SEQUENCE_ID = 'root'

const INITIAL_ROOT_SLICES: Slice[] = [
  { id: 's1', label: 'Intro', startTime: 0, duration: 4, sourceOffset: 0, color: '#f97316' },
  {
    id: 's2',
    label: 'Main Act',
    startTime: 4,
    duration: 8,
    sourceOffset: 2,
    color: '#8b5cf6',
    nestedSequenceId: 'seq-main',
  },
  { id: 's3', label: 'B-Roll', startTime: 12, duration: 4, sourceOffset: 0, color: '#06b6d4' },
  { id: 's4', label: 'Outro', startTime: 16, duration: 4, sourceOffset: 1, color: '#10b981' },
]

const INITIAL_NESTED_SLICES: Slice[] = [
  { id: 'n1', label: 'Shot A', startTime: 0, duration: 3, sourceOffset: 0, color: '#ec4899' },
  { id: 'n2', label: 'Shot B', startTime: 3, duration: 2.5, sourceOffset: 1, color: '#f59e0b' },
  { id: 'n3', label: 'Shot C', startTime: 5.5, duration: 2.5, sourceOffset: 0.5, color: '#84cc16' },
]

export const useSequenceStore = create<SequenceState>((set) => ({
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
  navigationStack: [ROOT_SEQUENCE_ID],

  addSequence: (sequence) =>
    set((state) => ({
      sequences: { ...state.sequences, [sequence.id]: sequence },
    })),

  updateSlice: (sequenceId, sliceId, updates) =>
    set((state) => {
      const seq = state.sequences[sequenceId]
      if (!seq) return state
      return {
        sequences: {
          ...state.sequences,
          [sequenceId]: {
            ...seq,
            slices: seq.slices.map((s) => (s.id === sliceId ? { ...s, ...updates } : s)),
          },
        },
      }
    }),

  pushNavigation: (sequenceId) =>
    set((state) => ({
      navigationStack: [...state.navigationStack, sequenceId],
    })),

  popNavigation: () =>
    set((state) => ({
      navigationStack:
        state.navigationStack.length > 1
          ? state.navigationStack.slice(0, -1)
          : state.navigationStack,
    })),
}))
