import { useEffect } from 'react'
import { useAppStore, Image } from '@/lib/store'
import { startPolling } from '@/lib/usePoll'

/**
 * Handles all mosaic-level polling:
 *  - Nano Banana task polling  (images)
 *  - Video generation polling  (videos)
 *
 * Extracted from page.tsx to keep the page component lean.
 */
export function useMosaicPolling() {
  const {
    kieApiKey,
    activeVideoTasks,
    removeVideoTask,
    setGeneratedVideo,
    activeNanoTasks,
    removeNanoTask,
    addImages,
  } = useAppStore()

  // Handle nano banana polling
  useEffect(() => {
    if (activeNanoTasks.length === 0) return

    const cancellers = activeNanoTasks.map((task) =>
      startPolling({
        intervalMs: 5000,
        maxAttempts: 60,
        checkFn: async () => {
          const response = await fetch(`/api/nano-callback?taskId=${task.taskId}`, {
            headers: { Authorization: `Bearer ${kieApiKey}` },
            cache: 'no-store',
          })
          const result = await response.json()

          if (result.status === 'success' && result.imageUrls && result.imageUrls.length > 0) {
            const newImages: Image[] = result.imageUrls.map((url: string, index: number) => ({
              id: `nano-${task.taskId}-${index}`,
              url,
              status: 'done',
              prompt: `Nano Banana edit of ${task.sourceImageId}`,
            }))
            addImages(newImages)
            removeNanoTask(task.taskId)
            return 'done'
          } else if (result.status === 'fail') {
            console.error(`Nano task ${task.taskId} failed:`, result.error)
            removeNanoTask(task.taskId)
            return 'done'
          }
          return 'continue'
        },
      })
    )

    return () => cancellers.forEach((cancel) => cancel())
  }, [activeNanoTasks, kieApiKey, removeNanoTask, addImages])

  // Handle video generation polling
  useEffect(() => {
    if (activeVideoTasks.length === 0) return

    const cancellers = activeVideoTasks.map((task) =>
      startPolling({
        intervalMs: 5000,
        maxAttempts: 120,
        checkFn: async () => {
          const response = await fetch(`/api/video-callback?taskId=${task.taskId}`, {
            headers: { Authorization: `Bearer ${kieApiKey}` },
            cache: 'no-store',
          })
          const result = await response.json()

          if (result.status === 'success' && result.videoUrl) {
            setGeneratedVideo(task.imageId, {
              url: result.videoUrl,
              taskId: task.taskId,
              model: task.model || 'unknown',
            })
            removeVideoTask(task.taskId)
            return 'done'
          } else if (result.status === 'fail') {
            console.error(`Video task ${task.taskId} failed:`, result.error)
            removeVideoTask(task.taskId)
            return 'done'
          }
          return 'continue'
        },
      })
    )

    return () => cancellers.forEach((cancel) => cancel())
  }, [activeVideoTasks, kieApiKey, removeVideoTask, setGeneratedVideo])
}
