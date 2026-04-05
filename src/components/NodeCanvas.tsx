import React, { useRef, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeTypes,
  useReactFlow,
  Connection,
  Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'

import ClipNode from './nodes/ClipNode'
import SequenceNode from './nodes/SequenceNode'
import OutputNode from './nodes/OutputNode'
import TrimModal from './TrimModal'
import { useNodeEditorStore } from '../store/nodeEditorStore'
import type { ClipNodeData } from '../store/nodeEditorStore'

// ─── Node type registry ────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  clipNode: ClipNode,
  sequenceNode: SequenceNode,
  outputNode: OutputNode,
}

// ─── Inner canvas (must be inside ReactFlowProvider) ──────────────────────────

const NodeCanvasInner: React.FC = () => {  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addClipNode,
    trimModalClipNodeId,
    closeTrimModal,
    updateClipNodeTrim,
  } = useNodeEditorStore()

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { project } = useReactFlow()

  // ── Drag-and-drop from NodeLibrary ──────────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/node-data')
      if (!raw) return
      const data = JSON.parse(raw) as ClipNodeData
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      addClipNode(data, position)
    },
    [project, addClipNode],
  )

  // ── Connection validation ────────────────────────────────────────────────
  const isValidConnection = useCallback(
    (connection: Connection | Edge): boolean => {
      const { source, target, targetHandle } = connection as Connection
      if (!source || !target || !targetHandle) return false

      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return false

      const validSources = ['clipNode', 'sequenceNode']
      const validTargets = ['sequenceNode', 'outputNode']
      if (!validSources.includes(sourceNode.type ?? '')) return false
      if (!validTargets.includes(targetNode.type ?? '')) return false

      // Prevent connecting to an already-occupied input handle
      const occupied = edges.some(
        (e) => e.target === target && e.targetHandle === targetHandle,
      )
      return !occupied
    },
    [nodes, edges],
  )

  // ── Trim modal ───────────────────────────────────────────────────────────
  const trimNode = useMemo(
    () =>
      trimModalClipNodeId
        ? nodes.find((n) => n.id === trimModalClipNodeId)
        : null,
    [trimModalClipNodeId, nodes],
  )

  const trimClip = trimNode
    ? {
        id: (trimNode.data as ClipNodeData).clipId,
        fileUrl: (trimNode.data as ClipNodeData).fileUrl,
        fileName: (trimNode.data as ClipNodeData).fileName,
        thumbnailUrl: (trimNode.data as ClipNodeData).thumbnailUrl,
        trimStart: (trimNode.data as ClipNodeData).trimStart,
        trimEnd: (trimNode.data as ClipNodeData).trimEnd,
        sourceDuration: (trimNode.data as ClipNodeData).sourceDuration,
        duration:
          (trimNode.data as ClipNodeData).trimEnd -
          (trimNode.data as ClipNodeData).trimStart,
      }
    : null

  return (
    <div ref={reactFlowWrapper} className="w-full h-full bg-[#111]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{
          style: { stroke: '#4ade80', strokeWidth: 2 },
          animated: true,
        }}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#333"
          gap={20}
        />
        <Controls className="[&>button]:bg-zinc-800 [&>button]:border-zinc-700 [&>button]:text-zinc-300" />
        <MiniMap
          style={{ background: '#1a1a1a' }}
          nodeColor={(n) => {
            if (n.type === 'clipNode') return '#2d5a27'
            if (n.type === 'sequenceNode') return '#2d4a7a'
            return '#7a4a1a'
          }}
        />
      </ReactFlow>

      {trimClip && trimModalClipNodeId && (
        <TrimModal
          clip={trimClip}
          onClose={closeTrimModal}
          onDone={(trimStart, trimEnd) => {
            updateClipNodeTrim(trimModalClipNodeId, trimStart, trimEnd)
            closeTrimModal()
          }}
        />
      )}
    </div>
  )
}

// ─── Public component (requires ReactFlowProvider from parent) ────────────────

const NodeCanvas: React.FC = NodeCanvasInner

export default NodeCanvas
