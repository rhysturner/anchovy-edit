import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { OutputNodeData } from '../../store/nodeEditorStore'

const OutputNode: React.FC<NodeProps<OutputNodeData>> = ({ data }) => {
  return (
    <div
      style={{ width: 140 }}
      className="rounded-xl border-2 border-[#7a4a1a] bg-[#2a1f0e] select-none"
    >
      {/* Header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b border-[#7a4a1a]">
        <span className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">
          Output
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-3 flex items-center gap-2">
        {/* Play triangle icon */}
        <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-sm text-orange-300 font-medium truncate">{data.label}</span>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          width: 12,
          height: 12,
          background: '#fb923c',
          border: '2px solid #2a1f0e',
        }}
      />
    </div>
  )
}

export default OutputNode
