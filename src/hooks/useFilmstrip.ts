import { useEffect, useRef, useState } from 'react'

/**
 * useFilmstrip — extracts `frameCount` evenly-spaced thumbnail frames from a
 * video URL by seeking a hidden <video> element and drawing each frame onto a
 * canvas.
 *
 * @returns An array of `frameCount` data-URL strings (JPEG).
 *          Empty strings are returned for any frame that hasn't loaded yet.
 */
export function useFilmstrip(videoUrl: string, frameCount = 4): string[] {
  const [frames, setFrames] = useState<string[]>(() => Array(frameCount).fill(''))
  // Track the URL that was used for the current extraction so we can skip
  // redundant work when nothing has changed.
  const lastUrlRef = useRef<string>('')

  useEffect(() => {
    if (!videoUrl || videoUrl === lastUrlRef.current) return
    lastUrlRef.current = videoUrl

    // Reset while we load the new video.
    setFrames(Array(frameCount).fill(''))

    let cancelled = false

    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.muted = true
    video.preload = 'metadata'

    // 16 : 9 thumbnail size
    canvas.width = 120
    canvas.height = 68

    const captureFrames = async () => {
      // Wait for metadata (duration, dimensions) to be available.
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.addEventListener('error', () => reject(new Error('video load error')), { once: true })
        video.load()
      })

      if (cancelled) return

      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const result: string[] = []
      // Centre each sample within its equal-width segment so the first frame
      // isn't always at t=0 (often a blank slate) and the last isn't at EOF.
      const FRAME_CENTER_OFFSET = 0.5

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) return
        const time = (duration / frameCount) * (i + FRAME_CENTER_OFFSET)
        await new Promise<void>((resolve) => {
          const onSeeked = () => resolve()
          video.addEventListener('seeked', onSeeked, { once: true })
          video.currentTime = time
        })
        if (cancelled) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        result.push(canvas.toDataURL('image/jpeg', 0.7))
      }

      setFrames(result)
    }

    captureFrames().catch(() => {
      if (!cancelled) setFrames(Array(frameCount).fill(''))
    })

    return () => {
      cancelled = true
      video.src = ''
    }
  }, [videoUrl, frameCount])

  return frames
}
