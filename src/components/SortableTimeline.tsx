/**
 * SortableTimeline — Linear Sequential Storyboard
 *
 * Features:
 *  1. Pace & Rhythm controller (Slow / Balanced / Fast) that ripples all clip
 *     durations and re-calculates the timeline with zero gaps.
 *  2. Drag-and-drop reordering via @dnd-kit/sortable.  A ghost overlay shows
 *     the dragged clip; the remaining clips slide to reveal the drop target.
 *  3. Sequential trim (Head & Tail).  Adjusting either edge of a clip
 *     automatically ripples every subsequent clip's timeline position —
 *     gaps are structurally impossible because positions are derived from
 *     the sum of durations, never stored independently.
 *  4. "Sync to Beats" toggle — when audio beats are present in videoStore,
 *     trim handles magnetic-snap to the nearest detected transient.
 *  5. Filmstrip thumbnails inside each clip card, extracted via canvas.
 *  6. "Add Clip" button that opens a file picker and appends to the sequence.
 */

import React, { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  PACE_DURATIONS,
  PaceSetting,
  SequenceClip,
  getTimelineStart,
  getTotalDuration,
  snapToNearestBeat,
  useSortableTimelineStore,
} from '../store/sortableTimelineStore'
import { useVideoStore } from '../store/videoStore'
import { useFilmstrip } from '../hooks/useFilmstrip'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base pixels-per-second used to translate duration → card width. */
const PX_PER_SECOND = 60
/** Minimum card width (px) regardless of duration. */
const MIN_CARD_WIDTH = 80
/** Filmstrip frame count per clip. */
const FRAME_COUNT = 4
/** Trim handle width (px). */
const HANDLE_W = 10
/** Minimum clip duration (seconds). */
const MIN_DURATION = 0.1
/** Fallback source duration (seconds) when video metadata is unavailable. */
const DEFAULT_CLIP_DURATION = 10
/** Hex opacity suffix: very light tint (~13 % opacity). */
const HEX_OPACITY_LIGHT = '22'
/** Hex opacity suffix: light tint (~20 % opacity). */
const HEX_OPACITY_MEDIUM_LIGHT = '33'
/** Hex opacity suffix: medium tint (~33 % opacity). */
const HEX_OPACITY_MEDIUM = '55'
/** Hex opacity suffix: medium-dark tint (~53 % opacity). */
const HEX_OPACITY_MEDIUM_DARK = '88'
/** Hex opacity suffix: card background tint (~9 % opacity). */
const HEX_OPACITY_BG = '18'

// ─── FilmstripFrames ──────────────────────────────────────────────────────────

interface FilmstripFramesProps {
  videoUrl: string
  color: string
}

/**
 * Renders the extracted thumbnail frames for one clip.
 * Shows a coloured placeholder while frames are loading.
 */
const FilmstripFrames: React.FC<FilmstripFramesProps> = ({ videoUrl, color }) => {
  const frames = useFilmstrip(videoUrl, FRAME_COUNT)

  return (
    <div className="flex flex-1 overflow-hidden rounded-sm gap-px pointer-events-none select-none">
      {Array.from({ length: FRAME_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex-1 h-full relative overflow-hidden"
          style={{
            backgroundColor: color + HEX_OPACITY_LIGHT,
            minWidth: 0,
          }}
        >
          {frames[i] ? (
            <img
              src={frames[i]}
              alt=""
              draggable={false}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Loading shimmer */
            <div
              className="absolute inset-0 animate-pulse"
              style={{ backgroundColor: color + HEX_OPACITY_MEDIUM_LIGHT }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── TrimHandle ───────────────────────────────────────────────────────────────

type TrimSide = 'head' | 'tail'

interface TrimHandleProps {
  side: TrimSide
  color: string
  clip: SequenceClip
  beats: number[]
  syncToBeats: boolean
  onUpdate: (updates: Partial<Pick<SequenceClip, 'start' | 'end'>>) => void
}

/**
 * TrimHandle — the draggable left (Head) or right (Tail) edge of a clip card.
 *
 * Pointer events are stopped so the drag gesture does not accidentally trigger
 * the parent DnD context.
 *
 * Head trim:  dragging right increases `start` (trims the beginning of the
 *             source clip), decreasing duration.
 *             dragging left decreases `start`, extending back into the source.
 *
 * Tail trim:  dragging right increases `end`, extending duration.
 *             dragging left decreases `end`, trimming the tail.
 *
 * When `syncToBeats` is true, the resulting timestamp is snapped to the
 * nearest beat transient before committing to the store.
 */
const TrimHandle: React.FC<TrimHandleProps> = ({
  side,
  color,
  clip,
  beats,
  syncToBeats,
  onUpdate,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)
  const startRef = useRef<{ pointerX: number; origStart: number; origEnd: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      startRef.current = {
        pointerX: e.clientX,
        origStart: clip.start,
        origEnd: clip.end,
      }
      setIsDragging(true)

      const handleMove = (ev: PointerEvent) => {
        if (!startRef.current) return
        const { pointerX, origStart, origEnd } = startRef.current
        const deltaPx = ev.clientX - pointerX
        const deltaSec = deltaPx / PX_PER_SECOND

        if (side === 'head') {
          // Head: clamp so we don't push start past end (min duration).
          const maxTrimIn = origEnd - origStart - MIN_DURATION
          const maxExtend = origStart // can't go below 0
          const clamped = Math.max(-maxExtend, Math.min(maxTrimIn, deltaSec))
          let newStart = origStart + clamped
          if (syncToBeats) newStart = snapToNearestBeat(newStart, beats)
          onUpdate({ start: newStart })
          setTooltip(`In: ${newStart.toFixed(2)}s`)
        } else {
          // Tail: clamp so we don't shrink below min duration.
          const newEnd = Math.max(origStart + MIN_DURATION, origEnd + deltaSec)
          const snapped = syncToBeats ? snapToNearestBeat(newEnd, beats) : newEnd
          onUpdate({ end: snapped })
          setTooltip(`Out: ${snapped.toFixed(2)}s`)
        }
      }

      const handleUp = () => {
        startRef.current = null
        setIsDragging(false)
        setTooltip(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [side, clip, beats, syncToBeats, onUpdate],
  )

  return (
    <div
      className="absolute top-0 h-full flex items-center justify-center cursor-ew-resize z-20 group/handle"
      style={{
        [side === 'head' ? 'left' : 'right']: 0,
        width: HANDLE_W,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
    >
      {/* Visual grip bar */}
      <div
        className="w-1 h-8 rounded-full transition-opacity"
        style={{
          backgroundColor: color,
          opacity: isDragging ? 1 : 0.5,
        }}
      />
      {/* Tooltip */}
      {isDragging && tooltip && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-[10px] font-mono whitespace-nowrap z-50 shadow-lg pointer-events-none"
          style={{ color }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

// ─── ClipCard (non-sortable, used in DragOverlay) ─────────────────────────────

interface ClipCardProps {
  clip: SequenceClip
  index: number
  sequenceLength: number
  beats: number[]
  syncToBeats: boolean
  isDragOverlay?: boolean
  onRemove: () => void
  onUpdateClip: (id: string, updates: Partial<Pick<SequenceClip, 'start' | 'end'>>) => void
}

const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  index,
  sequenceLength,
  beats,
  syncToBeats,
  isDragOverlay = false,
  onRemove,
  onUpdateClip,
}) => {
  const duration = clip.end - clip.start
  const cardWidth = Math.max(MIN_CARD_WIDTH, duration * PX_PER_SECOND)

  const handleUpdate = useCallback(
    (updates: Partial<Pick<SequenceClip, 'start' | 'end'>>) => {
      onUpdateClip(clip.id, updates)
    },
    [clip.id, onUpdateClip],
  )

  return (
    <div
      className="relative flex-shrink-0 select-none"
      style={{ width: cardWidth }}
    >
      {/* Gap indicator between clips (except the first) */}
      {index > 0 && !isDragOverlay && (
        <div className="absolute -left-px top-2 bottom-2 w-px bg-zinc-700 pointer-events-none" />
      )}

      {/* Card body */}
      <div
        className="relative flex flex-col rounded-md overflow-hidden"
        style={{
          border: `2px solid ${clip.color}`,
          backgroundColor: clip.color + HEX_OPACITY_BG,
          height: 80,
          boxShadow: isDragOverlay ? `0 8px 24px ${clip.color}${HEX_OPACITY_MEDIUM}` : undefined,
          opacity: isDragOverlay ? 0.95 : 1,
        }}
      >
        {/* ── Top row: index badge, label, position, remove ── */}
        <div
          className="flex items-center justify-between px-2 py-0.5 flex-shrink-0"
          style={{ backgroundColor: clip.color + HEX_OPACITY_MEDIUM_LIGHT }}
        >
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="text-[9px] font-bold px-1 rounded"
              style={{ backgroundColor: clip.color + HEX_OPACITY_MEDIUM, color: clip.color }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className="text-[10px] font-semibold truncate"
              style={{ color: clip.color }}
            >
              {clip.label}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[9px] font-mono text-zinc-500">
              {duration.toFixed(1)}s
            </span>
            {!isDragOverlay && (
              <button
                className="text-zinc-600 hover:text-red-400 transition-colors leading-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                title="Remove clip"
                aria-label={`Remove ${clip.label}`}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* ── Filmstrip ── */}
        <div className="flex-1 flex overflow-hidden px-1 pb-1 pt-0.5 min-h-0">
          <FilmstripFrames videoUrl={clip.videoUrl} color={clip.color} />
        </div>

        {/* ── Sequence position badge (bottom-left) ── */}
        {!isDragOverlay && (
          <div
            className="absolute bottom-1 left-2 text-[8px] font-mono pointer-events-none"
            style={{ color: clip.color + HEX_OPACITY_MEDIUM_DARK }}
          >
            {clip.start.toFixed(1)}→{clip.end.toFixed(1)}
          </div>
        )}

        {/* ── Trim handles ── */}
        {!isDragOverlay && (
          <>
            <TrimHandle
              side="head"
              color={clip.color}
              clip={clip}
              beats={beats}
              syncToBeats={syncToBeats}
              onUpdate={handleUpdate}
            />
            <TrimHandle
              side="tail"
              color={clip.color}
              clip={clip}
              beats={beats}
              syncToBeats={syncToBeats}
              onUpdate={handleUpdate}
            />
          </>
        )}
      </div>

      {/* Clip index badge below card */}
      {!isDragOverlay && (
        <div className="text-center mt-0.5">
          <span className="text-[8px] font-mono text-zinc-600">
            {index < sequenceLength - 1 ? '→' : '⏹'}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── SortableClipCard ─────────────────────────────────────────────────────────

interface SortableClipCardProps extends ClipCardProps {}

/**
 * Wraps ClipCard with dnd-kit's `useSortable` hook.
 * The entire card is draggable; trim handles stop event propagation to avoid
 * accidentally triggering a drag when the user is trimming.
 */
const SortableClipCard: React.FC<SortableClipCardProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.clip.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <ClipCard {...props} />
    </div>
  )
}

// ─── PaceController ───────────────────────────────────────────────────────────

interface PaceControllerProps {
  pace: PaceSetting
  onSetPace: (p: PaceSetting) => void
}

const PACE_OPTIONS: { key: PaceSetting; label: string; desc: string }[] = [
  { key: 'slow', label: 'Slow', desc: `${PACE_DURATIONS.slow}s` },
  { key: 'balanced', label: 'Balanced', desc: `${PACE_DURATIONS.balanced}s` },
  { key: 'fast', label: 'Fast', desc: `${PACE_DURATIONS.fast}s` },
]

const PaceController: React.FC<PaceControllerProps> = ({ pace, onSetPace }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-zinc-500 font-medium">Pace</span>
    <div className="flex rounded-lg bg-zinc-800 p-0.5 gap-0.5">
      {PACE_OPTIONS.map(({ key, label, desc }) => (
        <button
          key={key}
          onClick={() => onSetPace(key)}
          title={`${label}: ${desc} per clip — ripples all clips`}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            pace === key
              ? 'bg-orange-500 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {label}
          <span className="ml-1 opacity-60 text-[9px]">{desc}</span>
        </button>
      ))}
    </div>
  </div>
)

// ─── BeatSyncToggle ───────────────────────────────────────────────────────────

interface BeatSyncToggleProps {
  enabled: boolean
  hasBeats: boolean
  onToggle: () => void
}

const BeatSyncToggle: React.FC<BeatSyncToggleProps> = ({ enabled, hasBeats, onToggle }) => {
  if (!hasBeats) return null

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        enabled
          ? 'bg-purple-600/30 border-purple-500 text-purple-300'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
      }`}
      title={enabled ? 'Snap to beats: ON — trim handles magnetic-snap to audio transients' : 'Enable beat snapping'}
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13M9 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
      </svg>
      Sync to Beats
      <span
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
          enabled ? 'bg-purple-500 border-purple-400' : 'bg-transparent border-zinc-600'
        }`}
      />
    </button>
  )
}

// ─── TimelineRuler ────────────────────────────────────────────────────────────

interface TimelineRulerProps {
  totalSeconds: number
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ totalSeconds }) => {
  const tickInterval = totalSeconds > 20 ? 5 : totalSeconds > 10 ? 2 : 1
  const ticks = Array.from(
    { length: Math.ceil(totalSeconds / tickInterval) + 1 },
    (_, i) => i * tickInterval,
  )

  return (
    <div className="relative h-5 flex-shrink-0" style={{ width: totalSeconds * PX_PER_SECOND }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute flex flex-col items-center"
          style={{ left: t * PX_PER_SECOND, transform: 'translateX(-50%)' }}
        >
          <div className="h-1.5 w-px bg-zinc-600" />
          <span className="text-[8px] font-mono text-zinc-600 mt-0.5">{t}s</span>
        </div>
      ))}
    </div>
  )
}

// ─── AddClipButton ────────────────────────────────────────────────────────────

interface AddClipButtonProps {
  onAdd: (url: string, label: string, duration: number) => void
}

const AddClipButton: React.FC<AddClipButtonProps> = ({ onAdd }) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    // createObjectURL always produces a blob: URL. Validate before DOM assignment
    // to satisfy static analysis and guard against unexpected future changes.
    if (!url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
      return
    }
    // We need the video duration — load it via a transient element.
    const vid = document.createElement('video')
    vid.src = url
    vid.preload = 'metadata'
    vid.addEventListener(
      'loadedmetadata',
      () => {
        const dur = isFinite(vid.duration) ? vid.duration : DEFAULT_CLIP_DURATION
        const label = file.name.replace(/\.[^.]+$/, '')
        onAdd(url, label, dur)
        vid.src = ''
      },
      { once: true },
    )
    // Reset input so the same file can be re-added.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/mov,video/quicktime,video/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Add clip"
      />
      <button
        className="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-zinc-700 hover:border-orange-500 text-zinc-600 hover:text-orange-400 transition-colors"
        style={{ width: MIN_CARD_WIDTH, height: 80 }}
        onClick={() => inputRef.current?.click()}
        title="Add clip"
        aria-label="Add clip to sequence"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-[9px] font-medium">Add Clip</span>
      </button>
    </>
  )
}

// ─── SortableTimeline ─────────────────────────────────────────────────────────

/**
 * SortableTimeline — the top-level component.
 *
 * State lives in `useSortableTimelineStore` (Zustand + Immer).
 * Timeline positions are always derived — never stored — so ripple trim and
 * zero-gap guarantees hold structurally:
 *
 *   timelineStart(clip[i]) = Σ (clip[j].end − clip[j].start)  for j < i
 */
const SortableTimeline: React.FC = () => {
  const {
    sequence,
    pace,
    syncToBeats,
    addClip,
    removeClip,
    reorderClips,
    updateClip,
    setPace,
    setSyncToBeats,
  } = useSortableTimelineStore()

  const beats = useVideoStore((s) => s.beats)

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small movement before activating drag so trim handle clicks
      // aren't misinterpreted as drag starts.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const fromIndex = sequence.findIndex((c) => c.id === active.id)
      const toIndex = sequence.findIndex((c) => c.id === over.id)
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderClips(fromIndex, toIndex)
      }
    },
    [sequence, reorderClips],
  )

  const totalDuration = getTotalDuration(sequence)
  const activeClip = activeId ? sequence.find((c) => c.id === activeId) ?? null : null
  const activeIndex = activeId ? sequence.findIndex((c) => c.id === activeId) : -1

  const clipIds = sequence.map((c) => c.id)

  return (
    <div className="flex flex-col gap-3 w-full bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-white">Sequential Storyboard</h2>
          <span className="text-xs text-zinc-500 font-mono">
            {sequence.length} clip{sequence.length !== 1 ? 's' : ''} · {totalDuration.toFixed(1)}s
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <PaceController pace={pace} onSetPace={setPace} />
          <BeatSyncToggle
            enabled={syncToBeats}
            hasBeats={beats.length > 0}
            onToggle={() => setSyncToBeats(!syncToBeats)}
          />
        </div>
      </div>

      {/* ── Hint ── */}
      <p className="text-[10px] text-zinc-600">
        Drag <span className="text-zinc-400">◀ Head</span> /&nbsp;
        <span className="text-zinc-400">Tail ▶</span> handles to trim.
        Grab a clip to reorder. Changing pace ripples all durations with no gaps.
      </p>

      {/* ── Timeline area ── */}
      <div className="overflow-x-auto pb-2">
        <div
          className="relative"
          style={{ width: Math.max(totalDuration * PX_PER_SECOND + MIN_CARD_WIDTH + 32, 400) }}
        >
          {/* Ruler */}
          <TimelineRuler totalSeconds={totalDuration + 1} />

          {/* Beat markers */}
          {syncToBeats && beats.length > 0 && (
            <div
              className="relative h-2 pointer-events-none"
              style={{ width: totalDuration * PX_PER_SECOND }}
            >
              {beats
                .filter((b) => b <= totalDuration)
                .map((b, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-purple-500/60"
                    style={{ left: b * PX_PER_SECOND }}
                  />
                ))}
            </div>
          )}

          {/* Clips row */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
              <div className="flex items-start gap-0 mt-1">
                {sequence.map((clip, index) => (
                  <SortableClipCard
                    key={clip.id}
                    clip={clip}
                    index={index}
                    sequenceLength={sequence.length}
                    beats={beats}
                    syncToBeats={syncToBeats}
                    onRemove={() => removeClip(clip.id)}
                    onUpdateClip={updateClip}
                  />
                ))}

                {/* Add Clip */}
                <div className="ml-2 mt-0 self-start">
                  <AddClipButton onAdd={addClip} />
                </div>
              </div>
            </SortableContext>

            {/* Drag overlay — floats above, shows the dragged clip */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
              {activeClip && (
                <ClipCard
                  clip={activeClip}
                  index={activeIndex}
                  sequenceLength={sequence.length}
                  beats={beats}
                  syncToBeats={syncToBeats}
                  isDragOverlay
                  onRemove={() => {}}
                  onUpdateClip={() => {}}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* ── Inspector table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono text-zinc-400">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-600">
              <th className="text-left py-1 pr-3">#</th>
              <th className="text-left py-1 pr-3">Clip</th>
              <th className="text-right py-1 pr-3">Timeline&nbsp;In</th>
              <th className="text-right py-1 pr-3">Src&nbsp;In</th>
              <th className="text-right py-1 pr-3">Src&nbsp;Out</th>
              <th className="text-right py-1">Duration</th>
            </tr>
          </thead>
          <tbody>
            {sequence.map((clip, index) => {
              const tIn = getTimelineStart(sequence, index)
              const dur = clip.end - clip.start
              return (
                <tr key={clip.id} className="border-b border-zinc-800/40">
                  <td className="py-0.5 pr-3 text-zinc-600">{index + 1}</td>
                  <td className="py-0.5 pr-3 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: clip.color }}
                    />
                    <span className="truncate max-w-[100px]">{clip.label}</span>
                  </td>
                  <td className="text-right py-0.5 pr-3 text-orange-400">{tIn.toFixed(2)}s</td>
                  <td className="text-right py-0.5 pr-3 text-purple-400">{clip.start.toFixed(2)}s</td>
                  <td className="text-right py-0.5 pr-3 text-blue-400">{clip.end.toFixed(2)}s</td>
                  <td className="text-right py-0.5 text-green-400">{dur.toFixed(2)}s</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SortableTimeline
