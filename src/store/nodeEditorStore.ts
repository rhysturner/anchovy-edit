import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow'

// ─── Node Data Types ───────────────────────────────────────────────────────────

export interface ClipNodeData {
  clipId: string
  fileName: string
  fileUrl: string
  thumbnailUrl: string
  trimStart: number
  trimEnd: number
  sourceDuration: number
  isActive: boolean
}

export interface SequenceNodeData {
  label: string
  inputCount: number
  isActive: boolean
}

export interface OutputNodeData {
  label: string
}

// ─── Store State ───────────────────────────────────────────────────────────────

interface NodeEditorState {
  nodes: Node[]
  edges: Edge[]
  activeNodeId: string | null
  trimModalClipNodeId: string | null
  previewTime: number

  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  setActiveNodeId: (id: string | null) => void
  setPreviewTime: (t: number) => void
  openTrimModal: (nodeId: string) => void
  closeTrimModal: () => void
  updateClipNodeTrim: (nodeId: string, trimStart: number, trimEnd: number) => void
  addClipNode: (clipData: ClipNodeData, position: { x: number; y: number }) => void
  addSequenceNode: (position: { x: number; y: number }) => void
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialOutputNode: Node<OutputNodeData> = {
  id: 'output-1',
  type: 'outputNode',
  position: { x: 700, y: 300 },
  data: { label: 'Output' },
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useNodeEditorStore = create<NodeEditorState>()(
  immer((set) => ({
    nodes: [initialOutputNode],
    edges: [],
    activeNodeId: null,
    trimModalClipNodeId: null,
    previewTime: 0,

    // These three use plain set() because reactflow helpers return new arrays directly
    onNodesChange: (changes) =>
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes)
      }),

    onEdgesChange: (changes) =>
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges)
      }),

    onConnect: (connection) =>
      set((state) => {
        state.edges = addEdge(connection, state.edges)
      }),

    setActiveNodeId: (id) =>
      set((state) => {
        state.activeNodeId = id
      }),

    setPreviewTime: (t) =>
      set((state) => {
        state.previewTime = t
      }),

    openTrimModal: (nodeId) =>
      set((state) => {
        state.trimModalClipNodeId = nodeId
      }),

    closeTrimModal: () =>
      set((state) => {
        state.trimModalClipNodeId = null
      }),

    updateClipNodeTrim: (nodeId, trimStart, trimEnd) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return
        const data = node.data as ClipNodeData
        data.trimStart = trimStart
        data.trimEnd = trimEnd
      }),

    addClipNode: (clipData, position) =>
      set((state) => {
        const id = Math.random().toString(36).slice(2, 10)
        const newNode: Node<ClipNodeData> = {
          id,
          type: 'clipNode',
          position,
          data: { ...clipData, isActive: false },
        }
        state.nodes.push(newNode)
      }),

    addSequenceNode: (position) =>
      set((state) => {
        const id = Math.random().toString(36).slice(2, 10)
        const newNode: Node<SequenceNodeData> = {
          id,
          type: 'sequenceNode',
          position,
          data: { label: 'Sequence', inputCount: 3, isActive: false },
        }
        state.nodes.push(newNode)
      }),
  })),
)
