import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { SequenceNodeData } from '../../store/nodeEditorStore'

const SequenceNode: React.FC<NodeProps<SequenceNodeData>> = ({ data }) => {
  const inputCount = data.inputCount ?? 3
  const label = data.label || 'Sequence'

  return (
    <div
      style={{ width: 180 }}
      className={`rounded-xl border-2 select-none transition-all ${
        data.isActive
          ? 'border-[#60a5fa] shadow-[0_0_20px_rgba(96,165,250,0.4)] bg-[#1a1f2e]'
          : 'border-[#2d4a7a] bg-[#1a1f2e]'
      }`}
    >
      {/* Header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b border-[#2d4a7a]">
        <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">
          Sequence
        </span>
        <span className="text-xs text-blue-300 font-medium truncate ml-2">{label}</span>
      </div>

      {/* Input slots */}
      <div className="py-2 relative">
        {Array.from({ length: inputCount }, (_, i) => (
          <div
            key={i}
            className="flex items-center px-4 py-1 relative"
            style={{ minHeight: 28 }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`input-${i}`}
              style={{
                top: `${(i / inputCount) * 100 + 50 / inputCount}%`,
                left: -6,
                width: 12,
                height: 12,
                background: '#60a5fa',
                border: '2px solid #1a1f2e',
                position: 'absolute',
              }}
            />
            <span className="text-xs text-zinc-500 ml-2">In {i + 1}</span>
          </div>
        ))}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: 12,
          height: 12,
          background: '#60a5fa',
          border: '2px solid #1a1f2e',
        }}
      />
    </div>
  )
}

export default SequenceNode
