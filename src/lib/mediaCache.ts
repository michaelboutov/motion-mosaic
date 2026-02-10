/**
 * Media Cache — downloads remote video/audio URLs into local blob URLs
 * for instant, reliable playback. Uses in-memory Map + optional IndexedDB
 * for cross-session persistence.
 *
 * Architecture:
 *   Remote URL → fetch() → Blob → URL.createObjectURL() → blobUrl
 *   The blobUrl is used as <video>.src for instant seeking with no network lag.
 */

type CacheEntry = {
  blobUrl: string
  blob: Blob
  mimeType: string
  size: number
  /** Timestamp when cached */
  cachedAt: number
}

type DownloadProgress = {
  url: string
  loaded: number
  total: number
  percent: number
}

type CacheListener = (event: 'progress' | 'ready' | 'error', data: any) => void

const DB_NAME = 'motion-mosaic-media'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

class MediaCache {
  private cache = new Map<string, CacheEntry>()
  private pending = new Map<string, Promise<string>>()
  private listeners = new Set<CacheListener>()
  private db: IDBDatabase | null = null
  private dbReady: Promise<void> | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.dbReady = this.openDB()
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Get a blob URL for the given remote URL.
   * If already cached, returns immediately.
   * If not, starts downloading and returns the blob URL when ready.
   */
  async get(remoteUrl: string): Promise<string> {
    // Already in memory
    const entry = this.cache.get(remoteUrl)
    if (entry) return entry.blobUrl

    // Already downloading
    const pending = this.pending.get(remoteUrl)
    if (pending) return pending

    // Try IndexedDB first
    const stored = await this.loadFromDB(remoteUrl)
    if (stored) {
      this.cache.set(remoteUrl, stored)
      this.emit('ready', { url: remoteUrl, blobUrl: stored.blobUrl })
      return stored.blobUrl
    }

    // Download fresh
    const promise = this.download(remoteUrl)
    this.pending.set(remoteUrl, promise)

    try {
      const blobUrl = await promise
      return blobUrl
    } finally {
      this.pending.delete(remoteUrl)
    }
  }

  /**
   * Check if a URL is already cached (sync, memory only).
   */
  has(remoteUrl: string): boolean {
    return this.cache.has(remoteUrl)
  }

  /**
   * Get cached blob URL synchronously (returns undefined if not cached).
   */
  getBlobUrl(remoteUrl: string): string | undefined {
    return this.cache.get(remoteUrl)?.blobUrl
  }

  /**
   * Preload multiple URLs in parallel.
   */
  async preloadAll(urls: string[]): Promise<void> {
    const unique = [...new Set(urls.filter(Boolean))]
    await Promise.allSettled(unique.map(url => this.get(url)))
  }

  /**
   * Remove a specific URL from cache.
   */
  revoke(remoteUrl: string) {
    const entry = this.cache.get(remoteUrl)
    if (entry) {
      URL.revokeObjectURL(entry.blobUrl)
      this.cache.delete(remoteUrl)
      this.removeFromDB(remoteUrl)
    }
  }

  /**
   * Clear entire cache.
   */
  clear() {
    this.cache.forEach(entry => URL.revokeObjectURL(entry.blobUrl))
    this.cache.clear()
    this.clearDB()
  }

  /**
   * Subscribe to cache events.
   */
  subscribe(listener: CacheListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Get cache stats.
   */
  getStats() {
    let totalSize = 0
    this.cache.forEach(e => totalSize += e.size)
    return {
      entries: this.cache.size,
      pending: this.pending.size,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    }
  }

  // ── Internal ───────────────────────────────────────────────────────

  private async download(remoteUrl: string): Promise<string> {
    try {
      // Route through server-side proxy to bypass CORS restrictions
      const fetchUrl = (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))
        ? `/api/media-proxy?url=${encodeURIComponent(remoteUrl)}`
        : remoteUrl
      const response = await fetch(fetchUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

      const contentLength = Number(response.headers.get('content-length') || 0)
      const mimeType = response.headers.get('content-type') || 'video/mp4'

      // Stream the response for progress tracking
      if (response.body && contentLength > 0) {
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let loaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.byteLength

          this.emit('progress', {
            url: remoteUrl,
            loaded,
            total: contentLength,
            percent: Math.round((loaded / contentLength) * 100),
          } as DownloadProgress)
        }

        const blob = new Blob(chunks as BlobPart[], { type: mimeType })
        return this.storeBlob(remoteUrl, blob, mimeType)
      } else {
        // Fallback: no streaming
        const blob = await response.blob()
        return this.storeBlob(remoteUrl, blob, mimeType)
      }
    } catch (err) {
      this.emit('error', { url: remoteUrl, error: err })
      throw err
    }
  }

  private storeBlob(remoteUrl: string, blob: Blob, mimeType: string): string {
    const blobUrl = URL.createObjectURL(blob)
    const entry: CacheEntry = {
      blobUrl,
      blob,
      mimeType,
      size: blob.size,
      cachedAt: Date.now(),
    }
    this.cache.set(remoteUrl, entry)
    this.saveToDB(remoteUrl, entry)
    this.emit('ready', { url: remoteUrl, blobUrl })
    return blobUrl
  }

  private emit(event: 'progress' | 'ready' | 'error', data: any) {
    this.listeners.forEach(fn => {
      try { fn(event, data) } catch { /* ignore listener errors */ }
    })
  }

  // ── IndexedDB persistence ──────────────────────────────────────────

  private async openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }
        request.onerror = () => {
          console.warn('MediaCache: IndexedDB open failed', request.error)
          resolve() // non-fatal
        }
      } catch {
        resolve() // IndexedDB not available
      }
    })
  }

  private async loadFromDB(remoteUrl: string): Promise<CacheEntry | null> {
    if (this.dbReady) await this.dbReady
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(remoteUrl)
        request.onsuccess = () => {
          const data = request.result
          if (data?.blob) {
            const blobUrl = URL.createObjectURL(data.blob)
            resolve({
              blobUrl,
              blob: data.blob,
              mimeType: data.mimeType,
              size: data.size,
              cachedAt: data.cachedAt,
            })
          } else {
            resolve(null)
          }
        }
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  private async saveToDB(remoteUrl: string, entry: CacheEntry) {
    if (this.dbReady) await this.dbReady
    if (!this.db) return

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        blob: entry.blob,
        mimeType: entry.mimeType,
        size: entry.size,
        cachedAt: entry.cachedAt,
      }, remoteUrl)
    } catch { /* non-fatal */ }
  }

  private async removeFromDB(remoteUrl: string) {
    if (this.dbReady) await this.dbReady
    if (!this.db) return

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(remoteUrl)
    } catch { /* non-fatal */ }
  }

  private async clearDB() {
    if (this.dbReady) await this.dbReady
    if (!this.db) return

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
    } catch { /* non-fatal */ }
  }
}

/** Singleton instance */
export const mediaCache = typeof window !== 'undefined' ? new MediaCache() : null!
