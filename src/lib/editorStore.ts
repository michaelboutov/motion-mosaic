import { create } from 'zustand'
import { mediaCache } from './mediaCache'

// ── Types ─────────────────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'text'

export interface EditorClip {
  id: string
  trackId: string
  type: TrackType
  /** Start position on timeline in seconds */
  startTime: number
  /** Duration of the clip in seconds */
  duration: number
  /** Original full duration before trimming */
  originalDuration: number
  /** Trim offsets from original (seconds) */
  trimStart: number
  trimEnd: number
  /** Source URL for video/audio */
  sourceUrl?: string
  /** Thumbnail URL for video clips */
  thumbnailUrl?: string
  /** Label / scene name */
  label: string
  /** Volume (0-1) for audio/video tracks */
  volume: number
  /** Text content for text overlays */
  text?: string
  /** Font size for text overlays */
  fontSize?: number
  /** Color for text overlays */
  color?: string
}

export interface EditorTrack {
  id: string
  type: TrackType
  label: string
  muted: boolean
  locked: boolean
  height: number
}

export interface EditorProject {
  id: string
  name: string
  /** Total project duration (auto-calculated) */
  duration: number
  /** Frames per second for preview */
  fps: number
  /** Output dimensions */
  width: number
  height: number
}

export interface EditorMarker {
  id: string
  time: number
  label: string
  color: string
}

export interface EditorState {
  // Project
  project: EditorProject
  tracks: EditorTrack[]
  clips: EditorClip[]

  // Playback
  currentTime: number
  isPlaying: boolean
  playbackRate: number

  // UI State
  selectedClipId: string | null
  zoom: number // pixels per second
  scrollX: number
  snapEnabled: boolean
  isDragging: boolean
  selectedClipIds: string[]
  rippleEnabled: boolean
  snapLineX: number | null
  markers: EditorMarker[]

  // History (undo/redo)
  history: { tracks: EditorTrack[]; clips: EditorClip[] }[]
  historyIndex: number

  // Export
  isExporting: boolean
  exportProgress: number

  // Media cache status: remoteUrl → 'pending' | 'ready' | 'error'
  mediaCacheStatus: Record<string, 'pending' | 'ready' | 'error'>

  // Actions
  setProject: (updates: Partial<EditorProject>) => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackRate: (rate: number) => void
  setSelectedClipId: (id: string | null) => void
  setZoom: (zoom: number) => void
  setScrollX: (x: number) => void
  setSnapEnabled: (enabled: boolean) => void
  setIsDragging: (dragging: boolean) => void
  toggleClipSelection: (clipId: string) => void
  addToSelection: (clipId: string) => void
  clearSelection: () => void
  removeSelectedClips: () => void
  setRippleEnabled: (enabled: boolean) => void
  setSnapLineX: (x: number | null) => void
  addMarker: (time: number, label?: string) => void
  removeMarker: (markerId: string) => void
  updateMarker: (markerId: string, updates: Partial<EditorMarker>) => void

  // Track actions
  addTrack: (type: TrackType, label?: string) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<EditorTrack>) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void

  // Clip actions
  addClip: (clip: Omit<EditorClip, 'id'>) => string
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<EditorClip>) => void
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void
  splitClip: (clipId: string, atTime: number) => void
  duplicateClip: (clipId: string) => void

  // Bulk actions
  addVideosToEditor: (videos: { url: string; thumbnailUrl?: string; label: string; duration?: number }[]) => void
  addAudioToEditor: (audio: { url: string; label: string; duration?: number }) => void
  clearEditor: () => void

  // History
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Export
  setIsExporting: (exporting: boolean) => void
  setExportProgress: (progress: number) => void

  // Media cache
  cacheAllMedia: () => Promise<void>
  getCachedUrl: (remoteUrl: string) => string
  getMediaCacheReady: () => boolean

  // Computed
  getTimelineDuration: () => number
  getClipsForTrack: (trackId: string) => EditorClip[]
  getClipAtTime: (trackId: string, time: number) => EditorClip | undefined
}

const DEFAULT_PROJECT: EditorProject = {
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  duration: 0,
  fps: 30,
  width: 1080,
  height: 1920,
}

const DEFAULT_TRACKS: EditorTrack[] = [
  { id: 'video-1', type: 'video', label: 'Video 1', muted: false, locked: false, height: 64 },
  { id: 'audio-vo', type: 'audio', label: 'Voiceover', muted: false, locked: false, height: 48 },
  { id: 'audio-music', type: 'audio', label: 'Music', muted: false, locked: false, height: 48 },
  { id: 'text-1', type: 'text', label: 'Text', muted: false, locked: false, height: 40 },
]

// ── Persistence helpers ──────────────────────────────────────────────
const EDITOR_STORAGE_KEY = 'motion-mosaic-editor'

function saveEditorState(state: EditorState) {
  try {
    const toSave = {
      project: state.project,
      tracks: state.tracks,
      clips: state.clips,
      markers: state.markers,
    }
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(toSave))
  } catch { /* quota errors etc */ }
}

function loadEditorState(): { project?: EditorProject; tracks?: EditorTrack[]; clips?: EditorClip[]; markers?: EditorMarker[] } | null {
  try {
    const raw = localStorage.getItem(EDITOR_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: { ...DEFAULT_PROJECT },
  tracks: [...DEFAULT_TRACKS],
  clips: [],
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,
  selectedClipId: null,
  zoom: 80, // 80px per second
  scrollX: 0,
  snapEnabled: true,
  isDragging: false,
  selectedClipIds: [],
  rippleEnabled: false,
  snapLineX: null,
  markers: [],
  history: [],
  historyIndex: -1,
  isExporting: false,
  exportProgress: 0,
  mediaCacheStatus: {},

  // ── Project ──────────────────────────────────────────────────────
  setProject: (updates) => set((s) => ({ project: { ...s.project, ...updates } })),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setSelectedClipId: (id) => set({ selectedClipId: id, selectedClipIds: id ? [id] : [] }),
  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(300, zoom)) }),
  setScrollX: (x) => set({ scrollX: Math.max(0, x) }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),

  toggleClipSelection: (clipId) => set((s) => {
    const ids = s.selectedClipIds.includes(clipId)
      ? s.selectedClipIds.filter(id => id !== clipId)
      : [...s.selectedClipIds, clipId]
    return { selectedClipIds: ids, selectedClipId: ids.length > 0 ? ids[ids.length - 1] : null }
  }),

  addToSelection: (clipId) => set((s) => {
    if (s.selectedClipIds.includes(clipId)) return {}
    const ids = [...s.selectedClipIds, clipId]
    return { selectedClipIds: ids, selectedClipId: clipId }
  }),

  clearSelection: () => set({ selectedClipIds: [], selectedClipId: null }),

  removeSelectedClips: () => {
    const state = get()
    if (state.selectedClipIds.length === 0) return
    state.pushHistory()
    const idsToRemove = new Set(state.selectedClipIds)
    if (state.rippleEnabled) {
      const removedByTrack = new Map<string, { startTime: number; duration: number }[]>()
      for (const id of idsToRemove) {
        const clip = state.clips.find(c => c.id === id)
        if (!clip) continue
        if (!removedByTrack.has(clip.trackId)) removedByTrack.set(clip.trackId, [])
        removedByTrack.get(clip.trackId)!.push({ startTime: clip.startTime, duration: clip.duration })
      }
      set((s) => {
        let newClips = s.clips.filter(c => !idsToRemove.has(c.id))
        for (const [trackId, removed] of removedByTrack) {
          const sorted = removed.sort((a, b) => b.startTime - a.startTime)
          for (const r of sorted) {
            newClips = newClips.map(c =>
              c.trackId === trackId && c.startTime > r.startTime
                ? { ...c, startTime: Math.max(0, c.startTime - r.duration) } : c
            )
          }
        }
        return { clips: newClips, selectedClipId: null, selectedClipIds: [] }
      })
    } else {
      set((s) => ({
        clips: s.clips.filter(c => !idsToRemove.has(c.id)),
        selectedClipId: null, selectedClipIds: [],
      }))
    }
  },

  setRippleEnabled: (enabled) => set({ rippleEnabled: enabled }),
  setSnapLineX: (x) => set({ snapLineX: x }),

  addMarker: (time, label) => set((s) => ({
    markers: [...s.markers, {
      id: `marker-${crypto.randomUUID().slice(0, 8)}`,
      time,
      label: label || `Marker ${s.markers.length + 1}`,
      color: ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6'][s.markers.length % 5],
    }],
  })),

  removeMarker: (markerId) => set((s) => ({
    markers: s.markers.filter(m => m.id !== markerId),
  })),

  updateMarker: (markerId, updates) => set((s) => ({
    markers: s.markers.map(m => m.id === markerId ? { ...m, ...updates } : m),
  })),

  // ── Tracks ──────────────────────────────────────────────────────
  addTrack: (type, label) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
    const defaultHeight = type === 'video' ? 64 : type === 'audio' ? 48 : 40
    const track: EditorTrack = {
      id,
      type,
      label: label || `${type.charAt(0).toUpperCase() + type.slice(1)} ${get().tracks.filter(t => t.type === type).length + 1}`,
      muted: false,
      locked: false,
      height: defaultHeight,
    }
    set((s) => ({ tracks: [...s.tracks, track] }))
    return id
  },

  removeTrack: (trackId) => set((s) => ({
    tracks: s.tracks.filter(t => t.id !== trackId),
    clips: s.clips.filter(c => c.trackId !== trackId),
  })),

  updateTrack: (trackId, updates) => set((s) => ({
    tracks: s.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t),
  })),

  reorderTracks: (fromIndex, toIndex) => set((s) => {
    const tracks = [...s.tracks]
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    return { tracks }
  }),

  // ── Clips ────────────────────────────────────────────────────────
  addClip: (clipData) => {
    const id = `clip-${crypto.randomUUID().slice(0, 8)}`
    const clip: EditorClip = { ...clipData, id }
    get().pushHistory()
    set((s) => ({ clips: [...s.clips, clip] }))
    return id
  },

  removeClip: (clipId) => {
    const state = get()
    const clip = state.clips.find(c => c.id === clipId)
    state.pushHistory()
    if (state.rippleEnabled && clip) {
      set((s) => ({
        clips: s.clips
          .filter(c => c.id !== clipId)
          .map(c => c.trackId === clip.trackId && c.startTime > clip.startTime
            ? { ...c, startTime: Math.max(0, c.startTime - clip.duration) } : c
          ),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
        selectedClipIds: s.selectedClipIds.filter(id => id !== clipId),
      }))
    } else {
      set((s) => ({
        clips: s.clips.filter(c => c.id !== clipId),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
        selectedClipIds: s.selectedClipIds.filter(id => id !== clipId),
      }))
    }
  },

  updateClip: (clipId, updates) => set((s) => ({
    clips: s.clips.map(c => c.id === clipId ? { ...c, ...updates } : c),
  })),

  moveClip: (clipId, newTrackId, newStartTime) => {
    get().pushHistory()
    set((s) => ({
      clips: s.clips.map(c =>
        c.id === clipId ? { ...c, trackId: newTrackId, startTime: Math.max(0, newStartTime) } : c
      ),
    }))
  },

  trimClip: (clipId, trimStart, trimEnd) => {
    get().pushHistory()
    set((s) => ({
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c
        const newTrimStart = Math.max(0, trimStart)
        const newTrimEnd = Math.max(0, trimEnd)
        const newDuration = c.originalDuration - newTrimStart - newTrimEnd
        return {
          ...c,
          trimStart: newTrimStart,
          trimEnd: newTrimEnd,
          duration: Math.max(0.1, newDuration),
        }
      }),
    }))
  },

  splitClip: (clipId, atTime) => {
    const clip = get().clips.find(c => c.id === clipId)
    if (!clip) return
    const relativeTime = atTime - clip.startTime
    if (relativeTime <= 0 || relativeTime >= clip.duration) return

    get().pushHistory()
    const leftDuration = relativeTime
    const rightDuration = clip.duration - relativeTime

    set((s) => ({
      clips: [
        ...s.clips.map(c => c.id === clipId ? { ...c, duration: leftDuration, trimEnd: c.trimEnd + rightDuration } : c),
        {
          ...clip,
          id: `clip-${crypto.randomUUID().slice(0, 8)}`,
          startTime: clip.startTime + leftDuration,
          duration: rightDuration,
          trimStart: clip.trimStart + leftDuration,
        },
      ],
    }))
  },

  duplicateClip: (clipId) => {
    const clip = get().clips.find(c => c.id === clipId)
    if (!clip) return
    get().pushHistory()
    const newClip: EditorClip = {
      ...clip,
      id: `clip-${crypto.randomUUID().slice(0, 8)}`,
      startTime: clip.startTime + clip.duration + 0.1,
    }
    set((s) => ({ clips: [...s.clips, newClip] }))
  },

  // ── Bulk Actions ─────────────────────────────────────────────────
  addVideosToEditor: (videos) => {
    const state = get()
    let videoTrack = state.tracks.find(t => t.type === 'video')
    if (!videoTrack) {
      const trackId = state.addTrack('video')
      videoTrack = get().tracks.find(t => t.id === trackId)!
    }

    const existingClips = get().clips.filter(c => c.trackId === videoTrack!.id)
    let nextStart = existingClips.length > 0
      ? Math.max(...existingClips.map(c => c.startTime + c.duration))
      : 0

    const newClips: EditorClip[] = videos.map((v) => {
      const dur = v.duration || 5
      const clip: EditorClip = {
        id: `clip-${crypto.randomUUID().slice(0, 8)}`,
        trackId: videoTrack!.id,
        type: 'video',
        startTime: nextStart,
        duration: dur,
        originalDuration: dur,
        trimStart: 0,
        trimEnd: 0,
        sourceUrl: v.url,
        thumbnailUrl: v.thumbnailUrl || v.url,
        label: v.label,
        volume: 1,
      }
      nextStart += dur
      return clip
    })

    get().pushHistory()
    set((s) => ({ clips: [...s.clips, ...newClips] }))
  },

  addAudioToEditor: (audio) => {
    const state = get()
    let voTrack = state.tracks.find(t => t.id === 'audio-vo')
    if (!voTrack) {
      const trackId = state.addTrack('audio', 'Voiceover')
      voTrack = get().tracks.find(t => t.id === trackId)!
    }

    const dur = audio.duration || 60
    get().pushHistory()
    set((s) => ({
      clips: [...s.clips, {
        id: `clip-${crypto.randomUUID().slice(0, 8)}`,
        trackId: voTrack!.id,
        type: 'audio',
        startTime: 0,
        duration: dur,
        originalDuration: dur,
        trimStart: 0,
        trimEnd: 0,
        sourceUrl: audio.url,
        label: audio.label,
        volume: 1,
      }],
    }))
  },

  clearEditor: () => set({
    clips: [],
    tracks: [...DEFAULT_TRACKS],
    currentTime: 0,
    isPlaying: false,
    selectedClipId: null,
    selectedClipIds: [],
    markers: [],
    rippleEnabled: false,
    history: [],
    historyIndex: -1,
    project: { ...DEFAULT_PROJECT, id: crypto.randomUUID() },
  }),

  // ── History ──────────────────────────────────────────────────────
  pushHistory: () => set((s) => {
    const snapshot = { tracks: structuredClone(s.tracks), clips: structuredClone(s.clips) }
    const newHistory = s.history.slice(0, s.historyIndex + 1)
    newHistory.push(snapshot)
    if (newHistory.length > 50) newHistory.shift()
    return { history: newHistory, historyIndex: newHistory.length - 1 }
  }),

  undo: () => set((s) => {
    if (s.historyIndex < 0) return {}
    const snapshot = s.history[s.historyIndex]
    return {
      tracks: structuredClone(snapshot.tracks),
      clips: structuredClone(snapshot.clips),
      historyIndex: s.historyIndex - 1,
    }
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.history.length - 1) return {}
    const snapshot = s.history[s.historyIndex + 1]
    return {
      tracks: structuredClone(snapshot.tracks),
      clips: structuredClone(snapshot.clips),
      historyIndex: s.historyIndex + 1,
    }
  }),

  // ── Export ───────────────────────────────────────────────────────
  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setExportProgress: (progress) => set({ exportProgress: progress }),

  // ── Media Cache ────────────────────────────────────────────────
  cacheAllMedia: async () => {
    if (!mediaCache) return
    const clips = get().clips
    const urls = clips.map(c => c.sourceUrl).filter(Boolean) as string[]
    const unique = [...new Set(urls)]

    // Mark all as pending
    const status: Record<string, 'pending' | 'ready' | 'error'> = {}
    for (const url of unique) {
      status[url] = mediaCache.has(url) ? 'ready' : 'pending'
    }
    set({ mediaCacheStatus: status })

    // Download all in parallel
    await Promise.allSettled(
      unique.map(async (url) => {
        try {
          await mediaCache.get(url)
          set((s) => ({
            mediaCacheStatus: { ...s.mediaCacheStatus, [url]: 'ready' },
          }))
        } catch {
          set((s) => ({
            mediaCacheStatus: { ...s.mediaCacheStatus, [url]: 'error' },
          }))
        }
      })
    )
  },

  getCachedUrl: (remoteUrl: string) => {
    if (!mediaCache || !remoteUrl) return remoteUrl || ''
    return mediaCache.getBlobUrl(remoteUrl) || remoteUrl
  },

  getMediaCacheReady: () => {
    const status = get().mediaCacheStatus
    const values = Object.values(status)
    return values.length > 0 && values.every(s => s === 'ready')
  },

  // ── Computed ─────────────────────────────────────────────────────
  getTimelineDuration: () => {
    const clips = get().clips
    if (clips.length === 0) return 30
    return Math.max(30, ...clips.map(c => c.startTime + c.duration)) + 5
  },

  getClipsForTrack: (trackId) => {
    return get().clips.filter(c => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime)
  },

  getClipAtTime: (trackId, time) => {
    return get().clips.find(c =>
      c.trackId === trackId && time >= c.startTime && time < c.startTime + c.duration
    )
  },
}))

// ── URL validation & repair helpers ──────────────────────────────────
function isValidMediaUrl(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://') ||
    url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')
}

function repairUrl(url: string | undefined): string | undefined {
  if (!url) return url
  // Fix duplicated URLs (e.g. "https://a.com/x.mp4https://a.com/x.mp4")
  // Detect if "https://" or "http://" appears more than once
  const httpCount = (url.match(/https?:\/\//g) || []).length
  if (httpCount > 1) {
    // Extract just the first URL
    const match = url.match(/^(https?:\/\/[^\s]+?)(?=https?:\/\/|$)/)
    return match ? match[1] : undefined
  }
  return url
}

function sanitizeClips(clips: EditorClip[]): EditorClip[] {
  return clips
    .map(c => ({
      ...c,
      sourceUrl: repairUrl(c.sourceUrl) || c.sourceUrl,
      thumbnailUrl: repairUrl(c.thumbnailUrl),
    }))
    .filter(c => {
      if (c.type === 'text') return true
      return isValidMediaUrl(c.sourceUrl)
    })
    .map(c => ({
      ...c,
      thumbnailUrl: isValidMediaUrl(c.thumbnailUrl) ? c.thumbnailUrl : undefined,
    }))
}

// ── Hydrate from localStorage AFTER React hydration ──────────────────
// Deferred to avoid SSR/client mismatch (server renders defaults,
// client would immediately override with stored data causing hydration errors).
if (typeof window !== 'undefined') {
  // Defer hydration so the first client render matches SSR
  setTimeout(() => {
    const saved = loadEditorState()
    if (saved) {
      useEditorStore.setState({
        ...(saved.project ? { project: saved.project } : {}),
        ...(saved.tracks ? { tracks: saved.tracks } : {}),
        ...(saved.clips ? { clips: sanitizeClips(saved.clips || []) } : {}),
        ...(saved.markers ? { markers: saved.markers } : {}),
      })
    }
  }, 0)

  // Persist on every change
  useEditorStore.subscribe((state) => {
    saveEditorState(state)
  })

  // Listen for cross-tab storage updates so the editor tab picks up
  // data written by the main tab right before window.open
  window.addEventListener('storage', (e) => {
    if (e.key === EDITOR_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        useEditorStore.setState({
          ...(parsed.project ? { project: parsed.project } : {}),
          ...(parsed.tracks ? { tracks: parsed.tracks } : {}),
          ...(parsed.clips ? { clips: sanitizeClips(parsed.clips || []) } : {}),
          ...(parsed.markers ? { markers: parsed.markers } : {}),
        })
      } catch { /* ignore */ }
    }
  })
}
