import React from 'react'
import { ReactFlowProvider } from 'reactflow'
import NodeLibrary from './NodeLibrary'
import NodeCanvas from './NodeCanvas'
import NodePreview from './NodePreview'
import NodeTimeline from './NodeTimeline'
import { useNodeEditorStore } from '../store/nodeEditorStore'

const NodeEditor: React.FC = () => {
  const { addSequenceNode } = useNodeEditorStore()

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#161616] flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="6" r="2" fill="currentColor" />
            <circle cx="18" cy="6" r="2" fill="currentColor" />
            <circle cx="12" cy="18" r="2" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h12M6 6l6 12M18 6l-6 12" />
          </svg>
          <span className="text-sm font-semibold text-white">Node Editor</span>
        </div>
        <button
          onClick={() => addSequenceNode({ x: 400, y: 200 })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1a1f2e] hover:bg-[#1e2640] border border-[#2d4a7a] text-blue-300 transition-colors"
        >
          <span>＋</span>
          Add Sequence
        </button>
      </div>

      {/* Main area: Library + Canvas (wrapped in single ReactFlowProvider) */}
      <div className="flex flex-1 overflow-hidden">
        <ReactFlowProvider>
          <NodeLibrary />
          <div className="flex-1 overflow-hidden">
            <NodeCanvas />
          </div>
        </ReactFlowProvider>
      </div>

      {/* Bottom area: Preview + Timeline */}
      <div className="flex border-t border-zinc-800 flex-shrink-0" style={{ height: 160 }}>
        <NodePreview />
        <NodeTimeline />
      </div>
    </div>
  )
}

export default NodeEditor
