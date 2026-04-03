import React, { useRef, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStoryboardStore, StoryboardClip } from '../store/storyboardStore'
import TrimModal from './TrimModal'

// ─── Thumbnail generation ─────────────────────────────────────────────────────

/**
 * Seeks a hidden <video> to 10 % of its duration and captures the frame as a
 * JPEG data URL via a temporary <canvas>.  Falls back to an empty string on
 * any error (e.g. codec not supported by the browser).
 */
function generateThumbnail(videoEl: HTMLVideoElement): Promise<string> {
  return new Promise((resolve) => {
    const capture = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(''); return }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        resolve('')
      }
    }

    if (videoEl.readyState >= 2) {
      videoEl.currentTime = videoEl.duration * 0.1
    } else {
      videoEl.addEventListener('loadeddata', () => {
        videoEl.currentTime = videoEl.duration * 0.1
      }, { once: true })
    }

    videoEl.addEventListener('seeked', capture, { once: true })
    // Safety timeout in case seeked never fires
    setTimeout(() => resolve(''), 3000)
  })
}

// ─── SortableCard ─────────────────────────────────────────────────────────────

interface SortableCardProps {
  clip: StoryboardClip
  isActive: boolean
  onDoubleClick: (clip: StoryboardClip) => void
  onRemove: (id: string) => void
}

const SortableCard: React.FC<SortableCardProps> = ({ clip, isActive, onDoubleClick, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex-shrink-0 w-36 rounded-xl overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing select-none ${
        isActive ? 'border-orange-500' : 'border-zinc-700 hover:border-zinc-500'
      }`}
      onDoubleClick={() => onDoubleClick(clip)}
      title="Double-click to trim"
      {...attributes}
      {...listeners}
    >
      {/* Thumbnail */}
      <div className="relative w-full bg-zinc-800" style={{ aspectRatio: '16/9' }}>
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.fileName}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              />
            </svg>
          </div>
        )}
        {/* Trim badge */}
        <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1 py-0.5 text-[10px] font-mono text-white leading-none">
          {clip.duration.toFixed(1)}s
        </div>
        {/* Remove button */}
        <button
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 flex items-center justify-center text-zinc-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(clip.id)
          }}
          title="Remove clip"
          aria-label="Remove clip"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Label */}
      <div className="px-2 py-1.5 bg-zinc-900">
        <p className="text-xs text-zinc-300 truncate leading-tight" title={clip.fileName}>
          {clip.fileName}
        </p>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
          {clip.trimStart.toFixed(1)}s – {clip.trimEnd.toFixed(1)}s
        </p>
      </div>
    </div>
  )
}

// ─── Storyboard ───────────────────────────────────────────────────────────────

interface StoryboardProps {
  /** Index of the clip currently playing in the preview (for highlight). */
  activeClipIndex?: number
}

/**
 * Storyboard — a horizontally-scrollable, drag-to-reorder list of video clips.
 *
 * - Drag any card to reorder (dnd-kit PointerSensor).
 * - Double-click a card to open the TrimModal for frame-accurate trimming.
 * - Click "+" or drag-drop a file onto the panel to add a new clip.
 * - Thumbnails are generated from the first ≈10 % frame via a hidden <video>.
 */
const Storyboard: React.FC<StoryboardProps> = ({ activeClipIndex }) => {
  const { storyboardClips, addClip, removeClip, reorderClips, updateClipTrim } = useStoryboardStore()
  const [trimTarget, setTrimTarget] = useState<StoryboardClip | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Hidden video used only for thumbnail extraction
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) return

    const fileUrl = URL.createObjectURL(file)
    const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    // Create (or reuse) a hidden video element for metadata + thumbnail
    if (!hiddenVideoRef.current) {
      hiddenVideoRef.current = document.createElement('video')
      hiddenVideoRef.current.muted = true
      hiddenVideoRef.current.playsInline = true
      hiddenVideoRef.current.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px'
      document.body.appendChild(hiddenVideoRef.current)
    }
    const hiddenVideo = hiddenVideoRef.current
    hiddenVideo.src = fileUrl

    // Wait for metadata to get duration
    const sourceDuration: number = await new Promise((resolve) => {
      const onMeta = () => {
        hiddenVideo.removeEventListener('loadedmetadata', onMeta)
        resolve(hiddenVideo.duration || 0)
      }
      hiddenVideo.addEventListener('loadedmetadata', onMeta)
      hiddenVideo.load()
      setTimeout(() => resolve(0), 5000)
    })

    const thumbnailUrl = await generateThumbnail(hiddenVideo)

    addClip({
      id,
      fileUrl,
      fileName: file.name,
      thumbnailUrl,
      trimStart: 0,
      trimEnd: sourceDuration,
      sourceDuration,
      duration: sourceDuration,
    })
  }, [addClip])

  // ── Input / drop handlers ────────────────────────────────────────────────

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach(processFile)
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  // ── dnd-kit reorder ──────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = storyboardClips.findIndex((c) => c.id === active.id)
      const newIndex = storyboardClips.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(storyboardClips, oldIndex, newIndex).map((c) => c.id)
      reorderClips(newOrder)
    },
    [storyboardClips, reorderClips],
  )

  // ── Trim modal ───────────────────────────────────────────────────────────

  const handleTrimDone = useCallback(
    (trimStart: number, trimEnd: number) => {
      if (!trimTarget) return
      updateClipTrim(trimTarget.id, trimStart, trimEnd)
      setTrimTarget(null)
    },
    [trimTarget, updateClipTrim],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`relative flex flex-col gap-3 rounded-xl border transition-colors ${
          isDragOver
            ? 'border-orange-500 bg-orange-500/5'
            : 'border-zinc-800 bg-zinc-900/50'
        } px-4 pt-3 pb-4`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">Storyboard</span>
            {storyboardClips.length > 0 && (
              <span className="text-xs text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">
                {storyboardClips.length} clip{storyboardClips.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            title="Add video clip"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add clip
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Empty state */}
        {storyboardClips.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-8 text-zinc-600 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              />
            </svg>
            <p className="text-sm">Drag & drop videos or click <strong className="text-zinc-500">Add clip</strong></p>
            <p className="text-xs">Double-click a card to trim</p>
          </div>
        )}

        {/* Sortable clip list */}
        {storyboardClips.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={storyboardClips.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 overflow-x-auto pb-1 group">
                {storyboardClips.map((clip, i) => (
                  <SortableCard
                    key={clip.id}
                    clip={clip}
                    isActive={i === activeClipIndex}
                    onDoubleClick={setTrimTarget}
                    onRemove={removeClip}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Trim Modal */}
      {trimTarget && (
        <TrimModal
          clip={trimTarget}
          onClose={() => setTrimTarget(null)}
          onDone={handleTrimDone}
        />
      )}
    </>
  )
}

export default Storyboard
