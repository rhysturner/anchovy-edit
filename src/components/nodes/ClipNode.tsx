import React, { useCallback } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ClipNodeData, useNodeEditorStore } from '../../store/nodeEditorStore'

const ClipNode: React.FC<NodeProps<ClipNodeData>> = ({ id, data }) => {
  const duration = data.trimEnd - data.trimStart

  const handleDoubleClick = useCallback(() => {
    useNodeEditorStore.getState().openTrimModal(id)
  }, [id])

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ width: 160 }}
      className={`rounded-xl border-2 overflow-hidden cursor-pointer select-none transition-all ${
        data.isActive
          ? 'border-[#4ade80] shadow-[0_0_20px_rgba(74,222,128,0.4)] bg-[#1a2a1a]'
          : 'border-[#2d5a27] bg-[#1a2a1a]'
      }`}
    >
      {/* Label */}
      <div className="px-2 pt-1.5 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-green-500 uppercase">
          Video
        </span>
      </div>

      {/* Thumbnail */}
      <div className="mx-2 mb-1">
        {data.thumbnailUrl ? (
          <img
            src={data.thumbnailUrl}
            alt={data.fileName}
            className="w-full h-16 object-cover rounded"
          />
        ) : (
          <div className="w-full h-16 rounded bg-[#2d5a27] flex items-center justify-center">
            <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
      </div>

      {/* File name */}
      <div className="px-2 pb-0.5">
        <p className="text-xs text-green-300 font-medium truncate" title={data.fileName}>
          {data.fileName}
        </p>
      </div>

      {/* Duration badge */}
      <div className="px-2 pb-2">
        <span className="text-xs text-zinc-400 font-mono">{duration.toFixed(2)}s</span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: 12,
          height: 12,
          background: '#4ade80',
          border: '2px solid #1a2a1a',
        }}
      />
    </div>
  )
}

export default ClipNode
