'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { useEditorStore, EditorClip } from '@/lib/editorStore'
import { Film, Volume2, Type } from 'lucide-react'
import ClipContextMenu from './ClipContextMenu'
import { useWaveform } from '@/lib/useWaveform'

interface TimelineClipProps {
  clip: EditorClip
  zoom: number
  trackIndex?: number
  trackHeight?: number
}

export default function TimelineClip({ clip, zoom, trackIndex = 0, trackHeight = 64 }: TimelineClipProps) {
  const { selectedClipId, selectedClipIds, setSelectedClipId, toggleClipSelection, updateClip, moveClip, trimClip, setIsDragging, snapEnabled, setSnapLineX, clips, tracks } = useEditorStore()
  const isSelected = selectedClipIds.includes(clip.id) || selectedClipId === clip.id
  const clipRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const [isTrimming, setIsTrimming] = useState<'left' | 'right' | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, startTime: 0, trimStart: 0, trimEnd: 0, trackId: '' })

  const width = clip.duration * zoom
  // During drag, freeze React's left so it doesn't fight with DOM manipulation
  const dragLeftRef = useRef<number | null>(null)
  const left = isDraggingRef.current && dragLeftRef.current !== null ? dragLeftRef.current : clip.startTime * zoom

  const typeColors = {
    video: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', accent: 'bg-purple-500', text: 'text-purple-300', selectedBorder: 'border-purple-400' },
    audio: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', accent: 'bg-emerald-500', text: 'text-emerald-300', selectedBorder: 'border-emerald-400' },
    text: { bg: 'bg-sky-500/20', border: 'border-sky-500/40', accent: 'bg-sky-500', text: 'text-sky-300', selectedBorder: 'border-sky-400' },
  }
  const colors = typeColors[clip.type]

  const TypeIcon = clip.type === 'video' ? Film : clip.type === 'audio' ? Volume2 : Type

  // ── Drag to move (direct DOM manipulation, commit on end) ─────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Multi-select: Cmd/Ctrl+click toggles, otherwise single-select
    if (e.metaKey || e.ctrlKey) {
      toggleClipSelection(clip.id)
      return
    }
    if (!selectedClipIds.includes(clip.id)) {
      setSelectedClipId(clip.id)
    }

    const el = clipRef.current
    if (!el) return

    const startX = e.clientX
    const startY = e.clientY
    const origStart = clip.startTime
    const origTrackId = clip.trackId
    const clipDuration = clip.duration
    const clipType = clip.type
    const clipId = clip.id
    // Read zoom from store at drag start so it's stable
    const dragZoom = useEditorStore.getState().zoom
    const dragSnap = useEditorStore.getState().snapEnabled

    let hasDragged = false
    let didPushHistory = false
    let finalStart = origStart
    let finalTrackId = origTrackId

    // Freeze React's left at the current position
    dragLeftRef.current = origStart * dragZoom
    isDraggingRef.current = true

    const handleDragMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const dy = me.clientY - startY

      if (!hasDragged && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
      if (!hasDragged) {
        hasDragged = true
        el.style.opacity = '0.8'
        el.style.zIndex = '30'
        setIsDragging(true)
        if (!didPushHistory) {
          useEditorStore.getState().pushHistory()
          didPushHistory = true
        }
      }

      const dt = dx / dragZoom
      let newStart = Math.max(0, origStart + dt)

      // Snap to other clips on same track
      if (dragSnap) {
        const snapThreshold = 5 / dragZoom
        const state = useEditorStore.getState()
        const otherClips = state.clips.filter(c => c.id !== clipId && c.trackId === finalTrackId)
        for (const other of otherClips) {
          const otherEnd = other.startTime + other.duration
          if (Math.abs(newStart - otherEnd) < snapThreshold) {
            newStart = otherEnd; break
          }
          if (Math.abs(newStart + clipDuration - other.startTime) < snapThreshold) {
            newStart = other.startTime - clipDuration; break
          }
        }
      }

      newStart = Math.max(0, newStart)
      finalStart = newStart

      // Cross-track: detect vertical movement
      const trackDelta = Math.round(dy / trackHeight)
      if (trackDelta !== 0) {
        const state = useEditorStore.getState()
        const compatibleTracks = state.tracks.filter(t => t.type === clipType)
        const currentIdx = compatibleTracks.findIndex(t => t.id === origTrackId)
        const newIdx = Math.max(0, Math.min(compatibleTracks.length - 1, currentIdx + trackDelta))
        finalTrackId = compatibleTracks[newIdx]?.id || origTrackId
      }

      // Direct DOM update — no React re-render
      el.style.left = `${newStart * dragZoom}px`
    }

    const handleDragEnd = () => {
      isDraggingRef.current = false
      dragLeftRef.current = null
      el.style.opacity = ''
      el.style.zIndex = ''
      el.style.left = '' // clear inline override so React takes back control
      setIsDragging(false)

      // Commit final position to store (single update)
      if (hasDragged) {
        const updates: Record<string, unknown> = { startTime: finalStart }
        if (finalTrackId !== origTrackId) updates.trackId = finalTrackId
        updateClip(clipId, updates)
      }

      setSnapLineX(null)
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }

    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }, [clip.id, clip.startTime, clip.trackId, clip.duration, clip.type, selectedClipIds, trackHeight])

  // ── Trim handles ──────────────────────────────────────────────────
  const handleTrimStart = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedClipId(clip.id)
    setIsTrimming(side)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startTime: clip.startTime,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
      trackId: clip.trackId,
    }

    const handleTrimMove = (me: MouseEvent) => {
      const dx = me.clientX - dragStartRef.current.x
      const dt = dx / zoom

      if (side === 'left') {
        const newTrimStart = Math.max(0, Math.min(clip.originalDuration - clip.trimEnd - 0.1, dragStartRef.current.trimStart + dt))
        const newDuration = clip.originalDuration - newTrimStart - clip.trimEnd
        const newStartTime = dragStartRef.current.startTime + (newTrimStart - dragStartRef.current.trimStart)
        updateClip(clip.id, {
          trimStart: newTrimStart,
          duration: Math.max(0.1, newDuration),
          startTime: Math.max(0, newStartTime),
        })
      } else {
        const newTrimEnd = Math.max(0, Math.min(clip.originalDuration - clip.trimStart - 0.1, dragStartRef.current.trimEnd - dt))
        const newDuration = clip.originalDuration - clip.trimStart - newTrimEnd
        updateClip(clip.id, {
          trimEnd: newTrimEnd,
          duration: Math.max(0.1, newDuration),
        })
      }
    }

    const handleTrimEnd = () => {
      setIsTrimming(null)
      window.removeEventListener('mousemove', handleTrimMove)
      window.removeEventListener('mouseup', handleTrimEnd)
    }

    window.addEventListener('mousemove', handleTrimMove)
    window.addEventListener('mouseup', handleTrimEnd)
  }, [clip, zoom])

  // ── Context menu ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedClipId(clip.id)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [clip.id, setSelectedClipId])

  // Validate thumbnail URL
  const validThumb = clip.thumbnailUrl && (
    clip.thumbnailUrl.startsWith('http://') || clip.thumbnailUrl.startsWith('https://') ||
    clip.thumbnailUrl.startsWith('blob:') || clip.thumbnailUrl.startsWith('data:') || clip.thumbnailUrl.startsWith('/')
  ) ? clip.thumbnailUrl : undefined
  // Thumbnail strip count
  const thumbCount = clip.type === 'video' && validThumb ? Math.max(1, Math.floor(width / 48)) : 0

  return (
    <>
      <div
        ref={clipRef}
        className={`absolute top-1 bottom-1 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing select-none group
          ${colors.bg} ${isSelected ? colors.selectedBorder + ' border-2 shadow-lg shadow-white/5' : colors.border}
          ${isDraggingRef.current ? 'opacity-80 z-30' : 'z-10'}
        `}
        style={{ left, width: Math.max(width, 4) }}
        onClick={(e) => {
          e.stopPropagation()
          if (e.metaKey || e.ctrlKey) { toggleClipSelection(clip.id) }
          else { setSelectedClipId(clip.id) }
        }}
        onMouseDown={handleDragStart}
        onContextMenu={handleContextMenu}
      >
        {/* Left trim handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-white/20 transition-colors flex items-center justify-center"
          onMouseDown={(e) => handleTrimStart(e, 'left')}
        >
          <div className={`w-0.5 h-4 rounded-full ${colors.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>

        {/* Thumbnail strip for video clips */}
        {thumbCount > 1 && validThumb && (
          <div className="absolute inset-0 flex opacity-30 pointer-events-none">
            {Array.from({ length: thumbCount }, (_, i) => (
              <div key={i} className="flex-1 h-full overflow-hidden">
                <img src={validThumb} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Clip content */}
        <div className="relative h-full flex items-center gap-1.5 px-3 overflow-hidden z-10">
          {clip.type === 'video' && validThumb && thumbCount <= 1 && width > 60 && (
            <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 border border-white/10">
              <img src={validThumb} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <TypeIcon className={`w-3 h-3 ${colors.text} flex-shrink-0`} />
          {width > 50 && (
            <span className={`text-[10px] font-medium ${colors.text} truncate`}>
              {clip.label}
            </span>
          )}
          {width > 120 && (
            <span className="text-[9px] text-zinc-500 font-mono ml-auto flex-shrink-0">
              {clip.duration.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Waveform decoration for audio clips */}
        {clip.type === 'audio' && (
          <WaveformDecoration clipId={clip.id} sourceUrl={clip.sourceUrl} />
        )}

        {/* Right trim handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-white/20 transition-colors flex items-center justify-center"
          onMouseDown={(e) => handleTrimStart(e, 'right')}
        >
          <div className={`w-0.5 h-4 rounded-full ${colors.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ClipContextMenu
          clipId={clip.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// Real waveform visualization with Web Audio API fallback
function WaveformDecoration({ clipId, sourceUrl }: { clipId: string; sourceUrl?: string }) {
  const realBars = useWaveform(sourceUrl, 60)

  // Fallback: deterministic pseudo-waveform from clipId
  const fallbackHeights = useMemo(() => {
    let hash = 0
    for (let i = 0; i < clipId.length; i++) {
      hash = ((hash << 5) - hash) + clipId.charCodeAt(i)
      hash |= 0
    }
    return Array.from({ length: 60 }, (_, i) => {
      const pseudo = Math.abs(Math.sin(hash + i * 1.37) * 10000) % 1
      return pseudo * 0.6 + 0.15
    })
  }, [clipId])

  const bars = realBars.length > 0 ? realBars : fallbackHeights

  return (
    <div className="absolute inset-0 flex items-end opacity-30 pointer-events-none px-0.5">
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${bars.length} 1`}>
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i}
            y={1 - h}
            width={0.7}
            height={h}
            fill="currentColor"
            className={realBars.length > 0 ? 'text-emerald-400' : 'text-emerald-600'}
          />
        ))}
      </svg>
    </div>
  )
}
