import { Image } from '@/lib/store'

interface RefreshResult {
  success: boolean
  updatedImages?: Image[]
}

/**
 * Given a task ID and a list of images that belong to it,
 * fetches fresh URLs from the appropriate callback endpoint
 * and returns updated image objects.
 *
 * Shared by ImageGrid, useArchitectActions (single + bulk refresh).
 */
export async function refreshTaskImages(opts: {
  taskId: string
  isMidjourney: boolean
  images: Image[]
  apiKey: string
}): Promise<RefreshResult> {
  const { taskId, isMidjourney, images, apiKey } = opts

  const endpoint = isMidjourney
    ? '/api/generate-batch/callback'
    : '/api/nano-callback'

  const res = await fetch(`${endpoint}?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const data = await res.json()

  if (data.status !== 'success') return { success: false }

  const urls: string[] | { resultUrl: string }[] = isMidjourney
    ? data.resultUrls
    : data.imageUrls

  if (!urls || urls.length === 0) return { success: false }

  const prefix = isMidjourney ? `mj-${taskId}-` : `nano-${taskId}-`

  const updatedImages = images.map((img) => {
    if (!img.id.startsWith(prefix)) return img
    const idx = parseInt(img.id.split('-').pop() || '')
    if (isNaN(idx) || idx < 0 || idx >= urls.length) return img
    const newUrl =
      typeof urls[idx] === 'string'
        ? (urls[idx] as string)
        : (urls[idx] as { resultUrl: string }).resultUrl
    return newUrl ? { ...img, url: newUrl, taskId } : img
  })

  return { success: true, updatedImages }
}

/**
 * Extract a task ID from an image's stored taskId or its ID string.
 * Image IDs follow the pattern: `mj-{taskId}-{index}` or `nano-{taskId}-{index}`.
 */
export function extractTaskId(image: Pick<Image, 'id' | 'taskId'>): string | null {
  if (image.taskId) return image.taskId
  const parts = image.id.split('-')
  if (parts.length >= 3) return parts.slice(1, -1).join('-')
  return null
}
