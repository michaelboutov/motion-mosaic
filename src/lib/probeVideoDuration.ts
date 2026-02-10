/**
 * Probe the actual duration of a video by loading its metadata in a hidden <video> element.
 * Routes remote URLs through the media proxy to bypass CORS.
 * Returns duration in seconds, or the provided fallback if probing fails.
 */
export function probeAudioDuration(url: string, fallback = 60): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) {
      resolve(fallback)
      return
    }

    const src = url.startsWith('http')
      ? `/api/media-proxy?url=${encodeURIComponent(url)}`
      : url

    const audio = new Audio()
    audio.preload = 'auto'

    let settled = false
    const finish = (dur: number) => {
      if (settled) return
      settled = true
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      resolve(dur)
    }

    const tryReadDuration = () => {
      const dur = audio.duration
      if (dur && isFinite(dur) && dur > 0) {
        finish(dur)
        return true
      }
      return false
    }

    // duration may start as Infinity for streamed audio, then update
    audio.addEventListener('loadedmetadata', () => { tryReadDuration() }, { once: true })
    audio.addEventListener('durationchange', () => { tryReadDuration() })
    audio.addEventListener('canplaythrough', () => { tryReadDuration() }, { once: true })

    audio.addEventListener('error', () => {
      console.warn('probeAudioDuration: failed to load metadata for', url)
      finish(fallback)
    }, { once: true })

    // Longer timeout for large audio files
    setTimeout(() => {
      if (!settled) {
        // Last attempt to read duration before giving up
        const dur = audio.duration
        finish(dur && isFinite(dur) && dur > 0 ? dur : fallback)
      }
    }, 15000)

    audio.src = src
  })
}

export function probeVideoDuration(url: string, fallback = 5): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) {
      resolve(fallback)
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    // Use the media proxy for remote URLs to avoid CORS issues
    const src = url.startsWith('http')
      ? `/api/media-proxy?url=${encodeURIComponent(url)}`
      : url

    let settled = false
    const finish = (dur: number) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      video.load()
      resolve(dur)
    }

    video.addEventListener('loadedmetadata', () => {
      const dur = video.duration
      finish(dur && isFinite(dur) && dur > 0 ? dur : fallback)
    }, { once: true })

    video.addEventListener('error', () => {
      console.warn('probeVideoDuration: failed to load metadata for', url)
      finish(fallback)
    }, { once: true })

    // Safety timeout — don't hang forever
    setTimeout(() => finish(fallback), 8000)

    video.src = src
  })
}
