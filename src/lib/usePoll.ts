/**
 * Generic polling utility.
 *
 * Calls `checkFn` every `intervalMs` until it returns a truthy
 * "done" signal or `maxAttempts` is reached.
 *
 * Returns a cancel function.
 */
export function startPolling(opts: {
  checkFn: () => Promise<'done' | 'continue'>
  intervalMs?: number
  maxAttempts?: number
  onTimeout?: () => void
}): () => void {
  const { checkFn, intervalMs = 3000, maxAttempts = 100, onTimeout } = opts
  let attempts = 0
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = async () => {
    if (cancelled) return
    attempts++
    if (attempts > maxAttempts) {
      onTimeout?.()
      return
    }

    try {
      const result = await checkFn()
      if (result === 'done' || cancelled) return
    } catch {
      // swallow – will retry on next tick
    }

    if (!cancelled) {
      timer = setTimeout(tick, intervalMs)
    }
  }

  // Fire first check immediately
  tick()

  return () => {
    cancelled = true
    if (timer) clearTimeout(timer)
  }
}
