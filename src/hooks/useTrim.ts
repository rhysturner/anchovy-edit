import { useCallback, useRef, useState } from 'react'
import { useMotionValue } from 'framer-motion'
import { useSequenceStore, Slice } from '../store/sequenceStore'

export type TrimSide = 'head' | 'tail'

export interface TrimDragState {
  isDragging: boolean
  side: TrimSide | null
  /** Signed seconds offset relative to the un-trimmed position. */
  tooltipDelta: number
  /** Absolute source timestamp at the trim point (seconds). */
  tooltipTimestamp: number
}

interface UseTrimOptions {
  sequenceId: string
  slice: Slice
  /** Pixels per second on the current timeline ruler. */
  pxPerSecond: number
}

interface UseTrimReturn {
  dragState: TrimDragState
  /** Motion value driving the head handle's x translation (px). */
  headX: ReturnType<typeof useMotionValue<number>>
  /** Motion value driving the tail handle's x translation (px). */
  tailX: ReturnType<typeof useMotionValue<number>>
  onHeadPointerDown: (e: React.PointerEvent) => void
  onTailPointerDown: (e: React.PointerEvent) => void
}

/**
 * useTrim — precision trim hook for a single Slice.
 *
 * Head trim (left edge):
 *   Dragging right increases `sourceOffset` and decreases `duration` so the
 *   visible end-point stays fixed — the clip starts later in the source.
 *   Dragging left extends the clip back into the source.
 *
 * Tail trim (right edge):
 *   Dragging right extends `duration`; dragging left shortens it.
 *
 * Both handles expose a MotionValue (`headX` / `tailX`) that drives a
 * framer-motion `motion.div` for smooth 60 fps visual feedback.  The handle
 * resets to x=0 after each drag because the underlying slice data has already
 * been updated in real-time.
 */
export function useTrim({ sequenceId, slice, pxPerSecond }: UseTrimOptions): UseTrimReturn {
  const updateSlice = useSequenceStore((s) => s.updateSlice)
  const headX = useMotionValue(0)
  const tailX = useMotionValue(0)

  const [dragState, setDragState] = useState<TrimDragState>({
    isDragging: false,
    side: null,
    tooltipDelta: 0,
    tooltipTimestamp: 0,
  })

  const dragRef = useRef<{
    side: TrimSide
    startPointerX: number
    origDuration: number
    origSourceOffset: number
  } | null>(null)

  const startDrag = useCallback(
    (e: React.PointerEvent, side: TrimSide) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        side,
        startPointerX: e.clientX,
        origDuration: slice.duration,
        origSourceOffset: slice.sourceOffset,
      }

      const motionVal = side === 'head' ? headX : tailX

      setDragState({
        isDragging: true,
        side,
        tooltipDelta: 0,
        tooltipTimestamp: side === 'head' ? slice.sourceOffset : slice.sourceOffset + slice.duration,
      })

      const handleMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const { startPointerX, origDuration, origSourceOffset } = dragRef.current
        const deltaPx = ev.clientX - startPointerX
        const deltaSec = deltaPx / pxPerSecond

        if (side === 'head') {
          // Clamp: can't trim past the tail, and sourceOffset can't go below 0.
          const maxTrimIn = origDuration - 0.1
          const maxExtend = origSourceOffset
          const clamped = Math.max(-maxExtend, Math.min(maxTrimIn, deltaSec))
          const newSourceOffset = origSourceOffset + clamped
          const newDuration = origDuration - clamped

          updateSlice(sequenceId, slice.id, {
            sourceOffset: parseFloat(newSourceOffset.toFixed(3)),
            duration: parseFloat(newDuration.toFixed(3)),
          })
          motionVal.set(deltaPx)
          setDragState({
            isDragging: true,
            side,
            tooltipDelta: parseFloat(clamped.toFixed(3)),
            tooltipTimestamp: parseFloat(newSourceOffset.toFixed(3)),
          })
        } else {
          // Tail: simply adjust duration.
          const newDuration = Math.max(0.1, origDuration + deltaSec)
          updateSlice(sequenceId, slice.id, {
            duration: parseFloat(newDuration.toFixed(3)),
          })
          motionVal.set(deltaPx)
          setDragState({
            isDragging: true,
            side,
            tooltipDelta: parseFloat(deltaSec.toFixed(3)),
            tooltipTimestamp: parseFloat((origSourceOffset + newDuration).toFixed(3)),
          })
        }
      }

      const handleUp = () => {
        dragRef.current = null
        // Reset handle position — slice data is already up-to-date.
        motionVal.set(0)
        setDragState({ isDragging: false, side: null, tooltipDelta: 0, tooltipTimestamp: 0 })
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [headX, tailX, pxPerSecond, sequenceId, slice, updateSlice],
  )

  const onHeadPointerDown = useCallback(
    (e: React.PointerEvent) => startDrag(e, 'head'),
    [startDrag],
  )

  const onTailPointerDown = useCallback(
    (e: React.PointerEvent) => startDrag(e, 'tail'),
    [startDrag],
  )

  return { dragState, headX, tailX, onHeadPointerDown, onTailPointerDown }
}

/** Format a signed seconds delta as e.g. "+0.5s" or "-1.2s". */
export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}s`
}

/** Format an absolute timestamp as "MM:SS.t" (e.g. "1:04.5"). */
export function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${(s % 1).toFixed(1).slice(2)}`
}
