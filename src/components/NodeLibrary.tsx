import React, { useCallback } from 'react'
import { useStoryboardStore } from '../store/storyboardStore'
import { useNodeEditorStore } from '../store/nodeEditorStore'
import type { ClipNodeData } from '../store/nodeEditorStore'

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`
}

const NodeLibrary: React.FC = () => {
  const { storyboardClips } = useStoryboardStore()
  const { addSequenceNode } = useNodeEditorStore()

  const handleDragStart = useCallback(
    (event: React.DragEvent, clipData: ClipNodeData) => {
      event.dataTransfer.setData('application/node-data', JSON.stringify(clipData))
      event.dataTransfer.effectAllowed = 'copy'
    },
    [],
  )

  return (
    <div className="flex flex-col h-full w-[220px] flex-shrink-0 bg-[#161616] border-r border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Library</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Drag clips to canvas</p>
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {storyboardClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-3">
            <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <p className="text-xs text-zinc-500">Upload clips in Storyboard view</p>
          </div>
        ) : (
          storyboardClips.map((clip) => {
            const clipData: ClipNodeData = {
              clipId: clip.id,
              fileName: clip.fileName,
              fileUrl: clip.fileUrl,
              thumbnailUrl: clip.thumbnailUrl,
              trimStart: clip.trimStart,
              trimEnd: clip.trimEnd,
              sourceDuration: clip.sourceDuration,
              isActive: false,
            }
            return (
              <div
                key={clip.id}
                draggable
                onDragStart={(e) => handleDragStart(e, clipData)}
                className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-2 cursor-grab active:cursor-grabbing transition-colors"
              >
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.fileName}
                    className="w-full h-12 object-cover rounded mb-1.5"
                  />
                ) : (
                  <div className="w-full h-12 rounded bg-zinc-700 flex items-center justify-center mb-1.5">
                    <svg className="w-5 h-5 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                  </div>
                )}
                <p className="text-xs text-zinc-200 font-medium truncate" title={clip.fileName}>
                  {clip.fileName}
                </p>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {formatDuration(clip.duration)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Add nodes section */}
      <div className="p-2 border-t border-zinc-800 flex flex-col gap-1.5">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-1">Add Nodes</p>
        <button
          onClick={() => addSequenceNode({ x: 400, y: 300 })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1f2e] hover:bg-[#1e2640] border border-[#2d4a7a] text-blue-300 text-xs font-medium transition-colors"
        >
          <span className="text-base leading-none">＋</span>
          Sequence Node
        </button>
      </div>
    </div>
  )
}

export default NodeLibrary
