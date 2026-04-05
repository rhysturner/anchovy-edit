import { useMemo } from 'react'
import { Node, Edge } from 'reactflow'
import { useNodeEditorStore, ClipNodeData } from '../store/nodeEditorStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineClip {
  nodeId: string
  clipId: string
  fileName: string
  fileUrl: string
  thumbnailUrl: string
  trimStart: number
  trimEnd: number
  duration: number
  globalStart: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clipToTimelineClip(node: Node<ClipNodeData>, globalStart: number): TimelineClip {
  const d = node.data
  return {
    nodeId: node.id,
    clipId: d.clipId,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    thumbnailUrl: d.thumbnailUrl,
    trimStart: d.trimStart,
    trimEnd: d.trimEnd,
    duration: d.trimEnd - d.trimStart,
    globalStart,
  }
}

function resolveNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  globalStart: number,
): TimelineClip[] {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return []

  if (node.type === 'clipNode') {
    return [clipToTimelineClip(node as Node<ClipNodeData>, globalStart)]
  }

  if (node.type === 'sequenceNode') {
    const incomingEdges = edges
      .filter((e) => e.target === nodeId)
      .sort((a, b) => {
        const ia = parseInt((a.targetHandle ?? 'input-0').replace('input-', ''), 10)
        const ib = parseInt((b.targetHandle ?? 'input-0').replace('input-', ''), 10)
        return ia - ib
      })

    let offset = globalStart
    const result: TimelineClip[] = []
    for (const edge of incomingEdges) {
      const clips = resolveNode(edge.source, nodes, edges, offset)
      for (const clip of clips) {
        offset += clip.duration
        result.push(clip)
      }
    }
    return result
  }

  return []
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphToTimeline(): TimelineClip[] {
  const nodes = useNodeEditorStore((s) => s.nodes)
  const edges = useNodeEditorStore((s) => s.edges)

  return useMemo(() => {
    const outputNode = nodes.find((n) => n.type === 'outputNode')
    if (!outputNode) return []

    const edgeToOutput = edges.find((e) => e.target === outputNode.id)
    if (!edgeToOutput) return []

    return resolveNode(edgeToOutput.source, nodes, edges, 0)
  }, [nodes, edges])
}
