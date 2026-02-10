'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import TimelineClip from './TimelineClip'
import { Film, Volume2, Type, Eye, EyeOff, Lock, Unlock, Plus } from 'lucide-react'

export default function EditorTimeline() {
  const {
    tracks, clips, currentTime, setCurrentTime,
    zoom, scrollX, setScrollX,
    getTimelineDuration, getClipsForTrack,
    updateTrack, updateClip, addTrack, setSelectedClipId,
    isPlaying, snapLineX, markers, removeMarker,
  } = useEditorStore()

  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const totalDuration = getTimelineDuration()
  const timelineWidth = totalDuration * zoom

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ── Ruler marks (memoized — only recalculate on zoom/duration change) ──
  const rulerMarks = useMemo(() => {
    const marks: React.ReactElement[] = []
    const step = zoom >= 100 ? 1 : zoom >= 50 ? 2 : 5
    const majorInterval = step * 5
    for (let t = 0; t <= totalDuration; t += step) {
      const x = t * zoom
      const isMajor = t % majorInterval === 0 || t === 0
      marks.push(
        <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: x }}>
          <div className={`w-px ${isMajor ? 'h-4 bg-zinc-500' : 'h-2 bg-zinc-700'}`} />
          {isMajor && (
            <span className="text-[9px] text-zinc-500 font-mono mt-0.5 select-none">
              {t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}` : `${t}s`}
            </span>
          )}
        </div>
      )
    }
    return marks
  }, [zoom, totalDuration])

  // ── Playhead scrub on ruler drag ──────────────────────────────────
  const handleRulerDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const ruler = e.currentTarget

    const seek = (clientX: number) => {
      const rect = ruler.getBoundingClientRect()
      const x = clientX - rect.left
      const time = x / zoom
      setCurrentTime(Math.max(0, Math.min(totalDuration, time)))
    }

    seek(e.clientX)

    const onMove = (me: MouseEvent) => seek(me.clientX)
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, totalDuration])

  // ── Scroll & zoom (native listener for passive: false) ─────────
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Stop propagation so React 19's passive root listener never sees it
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const newZoom = useEditorStore.getState().zoom + (e.deltaY > 0 ? -5 : 5)
        useEditorStore.getState().setZoom(newZoom)
      } else if (e.deltaX === 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mounted])

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollX(scrollContainerRef.current.scrollLeft)
    }
  }, [setScrollX])

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return
    const playheadPx = currentTime * zoom
    const container = scrollContainerRef.current
    const visibleLeft = container.scrollLeft
    const visibleRight = container.scrollLeft + container.clientWidth

    if (playheadPx > visibleRight - 50) {
      container.scrollLeft = playheadPx - container.clientWidth / 2
    } else if (playheadPx < visibleLeft) {
      container.scrollLeft = Math.max(0, playheadPx - 100)
    }
  }, [currentTime, isPlaying, zoom])

  const trackTypeConfig = {
    video: { icon: Film, color: 'text-purple-400', bg: 'bg-purple-500/5' },
    audio: { icon: Volume2, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
    text: { icon: Type, color: 'text-sky-400', bg: 'bg-sky-500/5' },
  }

  const playheadX = currentTime * zoom

  return (
    <div className="flex flex-col bg-zinc-900/50 select-none h-full" ref={timelineRef}>
      {/* Main area: labels + scrollable timeline */}
      <div className="flex flex-1 min-h-0">
        {/* Left labels column */}
        <div className="w-36 shrink-0 bg-zinc-900/80 border-r border-zinc-800/60 flex flex-col">
          {/* Ruler spacer */}
          <div className="h-7 shrink-0 border-b border-zinc-800/60" />

          {/* Track labels */}
          {tracks.map((track) => {
            const cfg = trackTypeConfig[track.type]
            const Icon = cfg.icon
            return (
              <div
                key={track.id}
                className="flex items-center gap-2 px-3 border-b border-zinc-800/30 group"
                style={{ height: track.height }}
              >
                <Icon className={`w-3 h-3 ${cfg.color} shrink-0`} />
                <span className="text-[10px] font-medium text-zinc-400 truncate flex-1">{track.label}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`p-0.5 rounded ${track.muted ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title={track.muted ? 'Unmute' : 'Mute'}
                  >
                    {track.muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => updateTrack(track.id, { locked: !track.locked })}
                    className={`p-0.5 rounded ${track.locked ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title={track.locked ? 'Unlock' : 'Lock'}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add track button */}
          <button
            onClick={() => addTrack('video')}
            className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[10px]">Add Track</span>
          </button>
        </div>

        {/* Scrollable timeline content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden timeline-scroll"
          onScroll={handleScroll}
        >
          <div className="relative" style={{ width: Math.max(timelineWidth, 0), minWidth: '100%' }} suppressHydrationWarning>
            {/* Ruler */}
            <div
              className="relative h-7 border-b border-zinc-800/60 cursor-pointer bg-zinc-950/50"
              onMouseDown={handleRulerDrag}
            >
              {mounted && rulerMarks}
            </div>

            {/* Track lanes */}
            <div className="flex flex-col">
              {mounted && tracks.map((track, trackIdx) => {
                const cfg = trackTypeConfig[track.type]
                const trackClips = getClipsForTrack(track.id)
                return (
                  <div
                    key={track.id}
                    className={`relative border-b border-zinc-800/30 ${cfg.bg}`}
                    style={{
                      height: track.height,
                      backgroundImage: `repeating-linear-gradient(to right, rgba(63,63,70,0.2) 0px, rgba(63,63,70,0.2) 1px, transparent 1px, transparent ${zoom}px)`,
                      backgroundSize: `${zoom}px 100%`,
                    }}
                    onClick={() => setSelectedClipId(null)}
                  >
                    {trackClips.map((clip, clipIdx) => {
                      const nextClip = trackClips[clipIdx + 1]
                      const gapStart = clip.startTime + clip.duration
                      const hasSmallGap = nextClip && (nextClip.startTime - gapStart) < 0.5 && (nextClip.startTime - gapStart) >= -0.01
                      return (
                        <span key={clip.id}>
                          <TimelineClip clip={clip} zoom={zoom} trackIndex={trackIdx} trackHeight={track.height} />
                          {hasSmallGap && (
                            <button
                              className="absolute top-1/2 -translate-y-1/2 z-20 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 hover:border-amber-500 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 text-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                              style={{ left: gapStart * zoom - 10 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                // Create crossfade by overlapping clips slightly
                                const overlap = 0.3
                                updateClip(nextClip.id, { startTime: Math.max(0, nextClip.startTime - overlap) })
                                useEditorStore.getState().pushHistory()
                              }}
                              title="Add crossfade transition"
                            >
                              +
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Snap indicator line */}
            {snapLineX !== null && (
              <div
                className="absolute top-0 bottom-0 z-50 pointer-events-none"
                style={{ left: snapLineX }}
              >
                <div className="w-px h-full bg-amber-400/60 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
              </div>
            )}

            {/* Markers on ruler */}
            {mounted && markers.map((marker) => (
              <div
                key={marker.id}
                className="absolute top-0 z-30 cursor-pointer group/marker"
                style={{ left: marker.time * zoom }}
                onClick={(e) => { e.stopPropagation(); setCurrentTime(marker.time) }}
                title={marker.label}
              >
                <div className="w-2.5 h-2.5 -ml-[5px] rounded-full border-2 border-zinc-900" style={{ backgroundColor: marker.color }} />
                <div className="w-px h-full opacity-30 pointer-events-none" style={{ backgroundColor: marker.color }} />
                <button
                  onClick={(e) => { e.stopPropagation(); removeMarker(marker.id) }}
                  className="absolute -top-1 -right-3 w-3 h-3 rounded-full bg-red-500 text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover/marker:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 z-40 pointer-events-none"
              style={{ left: playheadX }}
            >
              <div className="w-3 h-3 bg-amber-500 rounded-b-sm -ml-1.5" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
              <div className="w-px h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Minimap */}
      {mounted && totalDuration > 0 && (
        <div
          className="h-3 bg-zinc-950/80 border-t border-zinc-800/30 relative cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            const targetTime = ratio * totalDuration
            setCurrentTime(Math.max(0, Math.min(totalDuration, targetTime)))
            if (scrollContainerRef.current) {
              const targetScroll = (targetTime * zoom) - scrollContainerRef.current.clientWidth / 2
              scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll)
            }
          }}
        >
          {/* Clip indicators on minimap */}
          {clips.map((clip) => {
            const left = (clip.startTime / totalDuration) * 100
            const width = (clip.duration / totalDuration) * 100
            const color = clip.type === 'video' ? 'bg-purple-500/50' : clip.type === 'audio' ? 'bg-emerald-500/50' : 'bg-sky-500/50'
            return (
              <div
                key={clip.id}
                className={`absolute top-0.5 bottom-0.5 rounded-sm ${color}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
              />
            )
          })}
          {/* Viewport indicator */}
          {scrollContainerRef.current && (
            <div
              className="absolute top-0 bottom-0 border border-amber-500/40 bg-amber-500/5 rounded-sm"
              style={{
                left: `${(scrollX / timelineWidth) * 100}%`,
                width: `${(scrollContainerRef.current.clientWidth / Math.max(timelineWidth, 1)) * 100}%`,
              }}
            />
          )}
          {/* Playhead on minimap */}
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-500"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>
      )}

      {/* Bottom hint */}
      <div className="h-5 bg-zinc-950/50 border-t border-zinc-800/40 flex items-center justify-center gap-4 px-4">
        <span className="text-[9px] text-zinc-600">Scroll: pan</span>
        <span className="text-[9px] text-zinc-600">⌘+Scroll: zoom</span>
        <span className="text-[9px] text-zinc-600">Drag edges: trim</span>
        <span className="text-[9px] text-zinc-600">M: marker</span>
        <span className="text-[9px] text-zinc-600">Right-click: menu</span>
      </div>
    </div>
  )
}
