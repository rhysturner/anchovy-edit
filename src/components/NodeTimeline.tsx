import React, { useCallback } from 'react'
import { useGraphToTimeline } from '../hooks/useGraphToTimeline'
import { useNodeEditorStore } from '../store/nodeEditorStore'

const NodeTimeline: React.FC = () => {
  const timeline = useGraphToTimeline()
  const activeNodeId = useNodeEditorStore((s) => s.activeNodeId)
  const previewTime = useNodeEditorStore((s) => s.previewTime)
  const setPreviewTime = useNodeEditorStore((s) => s.setPreviewTime)

  const totalDuration = timeline.reduce((sum, c) => sum + c.duration, 0)

  const handleClipClick = useCallback(
    (globalStart: number) => {
      setPreviewTime(globalStart)
    },
    [setPreviewTime],
  )

  if (timeline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#161616] border-t border-zinc-800 p-4">
        <p className="text-xs text-zinc-500 text-center">
          Connect clips to the Output Node to see the timeline
        </p>
      </div>
    )
  }

  const playheadPct = totalDuration > 0 ? (previewTime / totalDuration) * 100 : 0

  return (
    <div className="flex-1 flex flex-col bg-[#161616] border-t border-zinc-800 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 flex-shrink-0">
        <span className="text-xs text-zinc-500 font-medium">Timeline</span>
        <span className="text-xs text-zinc-400 font-mono">{totalDuration.toFixed(2)}s total</span>
      </div>

      {/* Track area */}
      <div className="flex-1 flex items-center px-3 py-2 relative overflow-hidden">
        <div className="flex w-full h-10 rounded overflow-hidden relative">
          {timeline.map((clip) => (
            <div
              key={clip.nodeId}
              title={`${clip.fileName}\n${clip.duration.toFixed(2)}s @ ${clip.globalStart.toFixed(2)}s`}
              onClick={() => handleClipClick(clip.globalStart)}
              className={`flex items-center px-1.5 overflow-hidden cursor-pointer transition-colors border-r border-zinc-900 ${
                clip.nodeId === activeNodeId
                  ? 'bg-green-500'
                  : 'bg-green-800 hover:bg-green-700'
              }`}
              style={{ flex: clip.duration }}
            >
              <span className="text-[10px] text-white font-medium truncate leading-none select-none">
                {clip.fileName}
              </span>
            </div>
          ))}

          {/* Playhead */}
          {totalDuration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default NodeTimeline
