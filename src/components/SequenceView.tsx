import React, { useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSequenceStore, TrackItem, MIN_SPLIT_MARGIN } from '../store/sequenceStore'
import { useTrim, formatDelta, formatTimestamp } from '../hooks/useTrim'
import { getCurrentClip } from '../utils/sequenceUtils'

// ─── Constants ───────────────────────────────────────────────────────────────

const PX_PER_SECOND = 48
const RULER_TICK_INTERVAL = 2 // seconds between ruler ticks
const TRACK_HEIGHT = 56 // px

// ─── SequenceBreadcrumbs ─────────────────────────────────────────────────────

interface SequenceBreadcrumbsProps {
  /** Ordered list of sequence IDs from root to current. */
  navigationHistory: string[]
  /** Human-readable label for each sequence ID. */
  labelFor: (id: string) => string
  /** Navigate directly to a sequence that is already in the history. */
  onNavigateTo: (sequenceId: string) => void
}

/**
 * SequenceBreadcrumbs — renders the full drill-down path.
 *
 * Each ancestor breadcrumb is a clickable button that calls `onNavigateTo`
 * to pop the history back to that level instantly.  The current (last) entry
 * is displayed as plain text.
 */
export const SequenceBreadcrumbs: React.FC<SequenceBreadcrumbsProps> = ({
  navigationHistory,
  labelFor,
  onNavigateTo,
}) => (
  <nav className="flex items-center gap-1 text-sm text-zinc-400" aria-label="Sequence navigation">
    {navigationHistory.map((id, i) => {
      const label = labelFor(id)
      const isLast = i === navigationHistory.length - 1
      return (
        <React.Fragment key={id}>
          {i > 0 && <span className="text-zinc-600" aria-hidden="true">/</span>}
          {isLast ? (
            <span className="text-white font-semibold" aria-current="page">
              {label}
            </span>
          ) : (
            <button
              className="text-zinc-500 hover:text-zinc-200 transition-colors underline-offset-2 hover:underline"
              onClick={() => onNavigateTo(id)}
              title={`Return to ${label}`}
            >
              {label}
            </button>
          )}
        </React.Fragment>
      )
    })}
  </nav>
)

// ─── TimelineItem ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  sequenceId: string
  slice: TrackItem
  onDoubleClick: (slice: TrackItem) => void
}

/**
 * TimelineItem — renders a single clip or nested-sequence block on the track,
 * including the left (Head) and right (Tail) precision-trim handles.
 */
const TimelineItem: React.FC<TimelineItemProps> = ({ sequenceId, slice, onDoubleClick }) => {
  const setTrimPreviewTime = useSequenceStore((s) => s.setTrimPreviewTime)

  const { dragState, headX, tailX, onHeadPointerDown, onTailPointerDown } = useTrim({
    sequenceId,
    slice,
    pxPerSecond: PX_PER_SECOND,
    onTrimPreview: setTrimPreviewTime,
  })

  const left = slice.startTime * PX_PER_SECOND
  const width = slice.duration * PX_PER_SECOND

  const isHead = dragState.isDragging && dragState.side === 'head'
  const isTail = dragState.isDragging && dragState.side === 'tail'
  const isAnyDrag = dragState.isDragging
  const isNested = slice.kind === 'sequence'

  return (
    <div
      className="absolute top-2 select-none"
      style={{ left, width, height: TRACK_HEIGHT - 16 }}
    >
      {/* Item body */}
      <div
        className="relative h-full rounded-md overflow-visible cursor-pointer group"
        style={{
          backgroundColor: slice.color + '33',
          border: `2px solid ${slice.color}`,
          boxShadow: isAnyDrag ? `0 0 0 2px ${slice.color}88` : undefined,
        }}
        onDoubleClick={() => onDoubleClick(slice)}
        title={isNested ? 'Double-click to drill into this sequence' : undefined}
      >
        {/* Label */}
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold pointer-events-none truncate px-6"
          style={{ color: slice.color }}
        >
          {slice.label}
          {isNested && (
            <span className="ml-1 opacity-60 text-[10px]">▶▶</span>
          )}
        </span>

        {/* sourceOffset badge */}
        <span
          className="absolute bottom-0.5 left-2 text-[9px] font-mono opacity-50 pointer-events-none"
          style={{ color: slice.color }}
        >
          +{slice.sourceOffset.toFixed(1)}s
        </span>

        {/* ── Head handle (left edge) ── */}
        <motion.div
          className="absolute left-0 top-0 h-full w-3 flex items-center justify-center cursor-ew-resize z-10 group-hover:opacity-100"
          style={{ x: headX, touchAction: 'none' }}
          onPointerDown={onHeadPointerDown}
        >
          <div
            className="w-1.5 h-6 rounded-full opacity-70 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: slice.color }}
          />
          {/* Head tooltip */}
          <AnimatePresence>
            {isHead && (
              <motion.div
                key="head-tip"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-[10px] font-mono whitespace-nowrap z-50 pointer-events-none shadow-lg"
                style={{ color: slice.color }}
              >
                <span className="text-zinc-400">Head </span>
                {formatDelta(dragState.tooltipDelta)}
                <span className="text-zinc-500 ml-1">@ {formatTimestamp(dragState.tooltipTimestamp)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Tail handle (right edge) ── */}
        <motion.div
          className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-ew-resize z-10 group-hover:opacity-100"
          style={{ x: tailX, touchAction: 'none' }}
          onPointerDown={onTailPointerDown}
        >
          <div
            className="w-1.5 h-6 rounded-full opacity-70 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: slice.color }}
          />
          {/* Tail tooltip */}
          <AnimatePresence>
            {isTail && (
              <motion.div
                key="tail-tip"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-[10px] font-mono whitespace-nowrap z-50 pointer-events-none shadow-lg"
                style={{ color: slice.color }}
              >
                <span className="text-zinc-400">Tail </span>
                {formatDelta(dragState.tooltipDelta)}
                <span className="text-zinc-500 ml-1">@ {formatTimestamp(dragState.tooltipTimestamp)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Ruler ───────────────────────────────────────────────────────────────────

interface RulerProps {
  totalSeconds: number
}

const Ruler: React.FC<RulerProps> = ({ totalSeconds }) => {
  const tickCount = Math.ceil(totalSeconds / RULER_TICK_INTERVAL)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * RULER_TICK_INTERVAL)

  return (
    <div className="relative h-6 w-full">
      {ticks.map((t) => {
        const left = t * PX_PER_SECOND
        return (
          <div
            key={t}
            className="absolute flex flex-col items-center"
            style={{ left, transform: 'translateX(-50%)' }}
          >
            <div className="h-2 w-px bg-zinc-600" />
            <span className="text-[9px] font-mono text-zinc-500 mt-0.5">{t}s</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── SequenceView ─────────────────────────────────────────────────────────────

/**
 * SequenceView — drill-down timeline component.
 *
 * Shows the track items of the currently-active sequence, a breadcrumb trail,
 * and a "Back" button.  Double-clicking a SequenceItem drills into it by
 * pushing its ID onto the navigation history.  Clicking any ancestor in the
 * breadcrumb trail navigates directly back to that level.
 *
 * Features:
 * - Magnetic Storyboard: tail-trim ripples subsequent clips (no gaps).
 * - Scrubable Playhead: click the ruler or drag the playhead line to seek.
 * - Split Tool: ✂ Split button cuts the active clip at the playhead position.
 */
const SequenceView: React.FC = () => {
  const {
    sequences,
    navigationHistory,
    pushNavigation,
    popNavigation,
    navigateTo,
    trimPreviewTime,
    playheadTime,
    setPlayheadTime,
    splitClip,
  } = useSequenceStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  /** Inner (non-scrolled) content div — used for pixel→time calculations. */
  const innerRef = useRef<HTMLDivElement>(null)
  /** Stable ref so drag handlers never hold stale totalSeconds values. */
  const totalSecondsRef = useRef(0)

  const currentId = navigationHistory[navigationHistory.length - 1]
  const currentSequence = sequences[currentId]

  // Derive slices safely (may be empty before currentSequence is confirmed)
  const slices = currentSequence?.slices ?? []
  const totalSeconds = slices.reduce((max, s) => Math.max(max, s.startTime + s.duration), 0) + 2
  totalSecondsRef.current = totalSeconds

  const { clip: activeClip } = getCurrentClip(slices, playheadTime)
  const canSplit =
    activeClip !== null &&
    playheadTime > activeClip.startTime + MIN_SPLIT_MARGIN &&
    playheadTime < activeClip.startTime + activeClip.duration - MIN_SPLIT_MARGIN

  // ── Playhead pointer-move handler (created once, reads from refs) ──────────

  const handlePlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      const pointerId = e.pointerId

      const handleMove = (ev: PointerEvent) => {
        const inner = innerRef.current
        if (!inner) return
        const rect = inner.getBoundingClientRect()
        const x = ev.clientX - rect.left
        const t = Math.max(0, Math.min(totalSecondsRef.current, x / PX_PER_SECOND))
        setPlayheadTime(t)
      }
      const handleUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId ?? pointerId)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [setPlayheadTime],
  )

  // ── Seek on ruler / track background click ─────────────────────────────────

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const inner = innerRef.current
      if (!inner) return
      const rect = inner.getBoundingClientRect()
      const x = clientX - rect.left
      setPlayheadTime(Math.max(0, Math.min(totalSecondsRef.current, x / PX_PER_SECOND)))
    },
    [setPlayheadTime],
  )

  // Keep playheadTime clamped when the sequence shrinks
  useEffect(() => {
    if (playheadTime > totalSeconds) {
      setPlayheadTime(totalSeconds)
    }
  }, [totalSeconds, playheadTime, setPlayheadTime])

  if (!currentSequence) return null

  const handleDoubleClick = (slice: TrackItem) => {
    if (slice.kind === 'sequence' && sequences[slice.nestedSequenceId]) {
      pushNavigation(slice.nestedSequenceId)
    }
  }

  const playheadLeft = playheadTime * PX_PER_SECOND

  return (
    <div className="flex flex-col gap-3 w-full bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {navigationHistory.length > 1 && (
          <button
            onClick={popNavigation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        <SequenceBreadcrumbs
          navigationHistory={navigationHistory}
          labelFor={(id) => sequences[id]?.label ?? id}
          onNavigateTo={navigateTo}
        />

        <div className="ml-auto flex items-center gap-2">
          {/* Playhead timestamp */}
          <span className="text-[10px] font-mono text-orange-400 bg-zinc-800 px-2 py-0.5 rounded select-none">
            ▶ {formatTimestamp(playheadTime)}
          </span>

          {/* Split button */}
          <button
            onClick={() => activeClip && splitClip(currentId, activeClip.id, playheadTime)}
            disabled={!canSplit}
            title={canSplit ? `Split "${activeClip!.label}" at ${formatTimestamp(playheadTime)}` : 'Playhead must be on a clip to split'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              canSplit
                ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
          >
            ✂ Split
          </button>
        </div>
      </div>

      {/* ── Hint ── */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-600">
          Click the ruler or drag the{' '}
          <span className="text-zinc-400">▷ playhead</span> to seek.
          Drag <span className="text-zinc-400">◀ Head</span> or{' '}
          <span className="text-zinc-400">Tail ▶</span> handles to precision-trim.
          {slices.some((s) => s.kind === 'sequence') && (
            <> Double-click a <span className="text-zinc-400">▶▶</span> clip to drill in.</>
          )}
        </p>
        {trimPreviewTime !== null && (
          <span className="text-[10px] font-mono text-orange-400 bg-zinc-800 px-2 py-0.5 rounded">
            ▶ preview {formatTimestamp(trimPreviewTime)}
          </span>
        )}
      </div>

      {/* ── Timeline ruler + track ── */}
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        {/* Inner container — reference point for pixel→time math */}
        <div ref={innerRef} style={{ width: totalSeconds * PX_PER_SECOND, minWidth: '100%', position: 'relative' }}>
          {/* ── Playhead line (spans full height of ruler + track) ── */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/50 z-20 pointer-events-none"
            style={{ left: playheadLeft }}
          />
          {/* Playhead handle (draggable circle at the top) */}
          <div
            className="absolute z-30 w-3.5 h-3.5 bg-white rounded-full cursor-ew-resize touch-none shadow-lg"
            style={{ left: playheadLeft, top: 0, transform: 'translate(-50%, -10%)' }}
            onPointerDown={handlePlayheadPointerDown}
          />

          {/* ── Ruler (click to seek) ── */}
          <div
            className="cursor-pointer"
            onClick={(e) => seekFromClientX(e.clientX)}
          >
            <Ruler totalSeconds={totalSeconds} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="relative bg-zinc-800 rounded-lg overflow-visible cursor-pointer"
              style={{ height: TRACK_HEIGHT }}
              onClick={(e) => {
                // Seek when clicking the track background (not a clip)
                if (e.target === e.currentTarget) seekFromClientX(e.clientX)
              }}
            >
              {/* Grid lines */}
              {Array.from({ length: Math.ceil(totalSeconds / RULER_TICK_INTERVAL) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full w-px bg-zinc-700/50 pointer-events-none"
                  style={{ left: i * RULER_TICK_INTERVAL * PX_PER_SECOND }}
                />
              ))}

              {/* Track items */}
              {slices.map((slice) => (
                <TimelineItem
                  key={slice.id}
                  sequenceId={currentId}
                  slice={slice}
                  onDoubleClick={handleDoubleClick}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Slice inspector table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono text-zinc-400">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-600">
              <th className="text-left py-1 pr-4">Item</th>
              <th className="text-right py-1 pr-4">Start</th>
              <th className="text-right py-1 pr-4">Duration</th>
              <th className="text-right py-1 pr-4">Src Offset</th>
              <th className="text-right py-1">End (src)</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s) => (
              <tr key={s.id} className={`border-b border-zinc-800/50 ${activeClip?.id === s.id ? 'bg-zinc-800/50' : ''}`}>
                <td className="py-1 pr-4 flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                  {s.kind === 'sequence' && <span className="text-zinc-600 text-[9px]">nested</span>}
                  {activeClip?.id === s.id && <span className="text-orange-400 text-[9px]">◀ active</span>}
                </td>
                <td className="text-right py-1 pr-4 text-orange-400">{s.startTime.toFixed(2)}s</td>
                <td className="text-right py-1 pr-4 text-green-400">{s.duration.toFixed(2)}s</td>
                <td className="text-right py-1 pr-4 text-purple-400">{s.sourceOffset.toFixed(2)}s</td>
                <td className="text-right py-1 text-zinc-400">
                  {(s.sourceOffset + s.duration).toFixed(2)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SequenceView
