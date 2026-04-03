import { TrackItem } from '../store/sequenceStore'

/**
 * Given a flat list of track items and a global playhead time (seconds),
 * returns the currently-active clip and the internal source timestamp within
 * that clip:
 *
 *   InternalTime = (GlobalPlayhead − ClipStartTime) + ClipSourceOffset
 *
 * Returns `{ clip: null, internalTime: 0 }` when the playhead falls in a gap
 * or past the last clip.
 */
export function getCurrentClip(
  slices: TrackItem[],
  playheadTime: number,
): { clip: TrackItem | null; internalTime: number } {
  for (const clip of slices) {
    const clipEnd = clip.startTime + clip.duration
    if (playheadTime >= clip.startTime && playheadTime < clipEnd) {
      const internalTime = playheadTime - clip.startTime + clip.sourceOffset
      return { clip, internalTime }
    }
  }
  return { clip: null, internalTime: 0 }
}
