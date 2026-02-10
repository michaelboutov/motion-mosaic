'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2, Volume2, VolumeX, Film, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'

export default function EditorPreview() {
  const {
    clips, tracks, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate,
  } = useEditorStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const currentSrcRef = useRef<string>('')

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getTimelineDuration = useEditorStore.getState().getTimelineDuration
  const totalDuration = getTimelineDuration()
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  useEffect(() => { setMounted(true) }, [])

  // ── Find active clips at playhead ───────────────────────────────────
  const activeVideoClip = useMemo(() =>
    clips.find(c => {
      const track = tracks.find(t => t.id === c.trackId)
      return track?.type === 'video' && !track.muted &&
        currentTime >= c.startTime && currentTime < c.startTime + c.duration
    }),
    [clips, tracks, currentTime]
  )

  const activeAudioClips = useMemo(() =>
    clips.filter(c => {
      const track = tracks.find(t => t.id === c.trackId)
      return track?.type === 'audio' && !track.muted &&
        currentTime >= c.startTime && currentTime < c.startTime + c.duration
    }),
    [clips, tracks, currentTime]
  )

  const activeTextClip = useMemo(() =>
    clips.find(c => {
      const track = tracks.find(t => t.id === c.trackId)
      return track?.type === 'text' && !track.muted &&
        currentTime >= c.startTime && currentTime < c.startTime + c.duration
    }),
    [clips, tracks, currentTime]
  )

  // ── Helper: proxy remote URLs ────────────────────────────────────
  const proxyUrl = (url: string) =>
    url && url.startsWith('http') ? `/api/media-proxy?url=${encodeURIComponent(url)}` : url

  // ── Video Source ────────────────────────────────────────────────────
  const rawVideoSrc = activeVideoClip?.sourceUrl || ''
  // Validate URL before using — reject corrupted/garbage values
  const isValidUrl = rawVideoSrc && (
    rawVideoSrc.startsWith('http://') || rawVideoSrc.startsWith('https://') ||
    rawVideoSrc.startsWith('blob:') || rawVideoSrc.startsWith('data:') || rawVideoSrc.startsWith('/')
  )
  // Use proxy for remote http(s) URLs to avoid CORS; keep blob:/data: URLs as-is
  const videoSrc = isValidUrl
    ? (rawVideoSrc.startsWith('http') ? `/api/media-proxy?url=${encodeURIComponent(rawVideoSrc)}` : rawVideoSrc)
    : ''

  useEffect(() => {
    const video = videoRef.current
    if (!video || !mounted) return

    if (videoSrc && videoSrc !== currentSrcRef.current) {
      currentSrcRef.current = videoSrc
      video.src = videoSrc
      video.load()

      if (activeVideoClip) {
        const localTime = currentTime - activeVideoClip.startTime + activeVideoClip.trimStart
        video.addEventListener('loadeddata', () => {
          video.currentTime = Math.max(0, localTime)
        }, { once: true })
      }

      // Silently handle load errors (expired URLs, network issues)
      video.addEventListener('error', () => {
        console.warn('EditorPreview: failed to load video', rawVideoSrc?.slice(0, 80))
      }, { once: true })
    } else if (!videoSrc && currentSrcRef.current) {
      currentSrcRef.current = ''
      video.removeAttribute('src')
      video.load()
    }
  }, [videoSrc, mounted])

  // ── Playback Sync ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !mounted || !activeVideoClip || !video.src) return

    if (isPlaying && video.paused && video.readyState >= 2) {
      video.play().catch(() => {})
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }

    const clipLocalTime = currentTime - activeVideoClip.startTime + activeVideoClip.trimStart
    if (Math.abs(video.currentTime - clipLocalTime) > 0.3) {
      video.currentTime = clipLocalTime
    }

    video.muted = isMuted
    video.volume = activeVideoClip.volume
    video.playbackRate = playbackRate
  }, [currentTime, isPlaying, isMuted, playbackRate, activeVideoClip?.id, mounted])

  // ── Playback Clock ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current)
      return
    }

    lastTimeRef.current = performance.now()

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000 * playbackRate
      lastTimeRef.current = now

      const state = useEditorStore.getState()
      const newTime = state.currentTime + delta
      const totalDuration = state.getTimelineDuration()

      if (newTime >= totalDuration) {
        setCurrentTime(totalDuration)
        setIsPlaying(false)
        return
      }
      setCurrentTime(newTime)
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, playbackRate, setCurrentTime, setIsPlaying])

  // ── Audio ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audioMap = audioElementsRef.current
    const activeIds = new Set(activeAudioClips.map(c => c.id))

    audioMap.forEach((audio, id) => {
      if (!activeIds.has(id)) {
        audio.pause()
        audio.removeAttribute('src')
        audioMap.delete(id)
      }
    })

    for (const clip of activeAudioClips) {
      if (!clip.sourceUrl) continue
      let audio = audioMap.get(clip.id)

      if (!audio) {
        audio = new Audio(proxyUrl(clip.sourceUrl))
        audio.preload = 'auto'
        audioMap.set(clip.id, audio)
      }

      const clipLocalTime = currentTime - clip.startTime + clip.trimStart
      audio.volume = isMuted ? 0 : clip.volume
      audio.playbackRate = playbackRate

      if (!isPlaying) {
        audio.pause()
        if (Math.abs(audio.currentTime - clipLocalTime) > 0.1) audio.currentTime = clipLocalTime
      } else {
        if (Math.abs(audio.currentTime - clipLocalTime) > 0.5) audio.currentTime = clipLocalTime
        if (audio.paused) audio.play().catch(() => {})
      }
    }
  }, [activeAudioClips, currentTime, isPlaying, isMuted, playbackRate])

  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach(a => { a.pause(); a.removeAttribute('src') })
      audioElementsRef.current.clear()
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleClickToPlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const handleFrameStep = useCallback((direction: -1 | 1) => {
    const fps = useEditorStore.getState().project.fps || 30
    const step = 1 / fps
    setCurrentTime(Math.max(0, currentTime + step * direction))
  }, [currentTime, setCurrentTime])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const newTime = ratio * totalDuration
    setCurrentTime(Math.max(0, Math.min(totalDuration, newTime)))
  }, [totalDuration, setCurrentTime])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 2500)
  }, [isPlaying])

  if (!mounted) return null

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden bg-zinc-950 relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_20%_50%,rgba(139,92,246,0.15),transparent_60%),radial-gradient(ellipse_at_80%_20%,rgba(245,158,11,0.1),transparent_60%),radial-gradient(ellipse_at_50%_80%,rgba(16,185,129,0.08),transparent_60%)]" />

      {/* Video container */}
      <div className="relative z-10" style={{ aspectRatio: '9/16', height: 'calc(100% - 24px)', maxWidth: '100%' }}>
        <div className="w-full h-full bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-zinc-800/30 relative">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover cursor-pointer"
            playsInline
            muted
            preload="auto"
            onClick={handleClickToPlay}
          />

          {/* Click-to-play overlay */}
          <AnimatePresence>
            {!isPlaying && activeVideoClip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer"
                onClick={handleClickToPlay}
              >
                <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          <AnimatePresence>
            {!activeVideoClip && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950"
              >
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-zinc-800/30 border border-zinc-700/30 flex items-center justify-center">
                    <Film className="w-7 h-7 text-zinc-700" />
                  </div>
                  <p className="text-zinc-600 text-xs">No clip at playhead</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text overlay */}
          <AnimatePresence>
            {activeTextClip?.text && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none z-20"
              >
                <div
                  className="px-5 py-2.5 bg-black/70 backdrop-blur-md rounded-xl border border-white/5"
                  style={{ fontSize: activeTextClip.fontSize || 24, color: activeTextClip.color || '#ffffff' }}
                >
                  {activeTextClip.text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clip label + audio indicators */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-20">
            <AnimatePresence>
              {activeVideoClip && (
                <motion.div
                  key={activeVideoClip.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/5"
                >
                  <Film className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-white/80 font-medium truncate max-w-[160px]">{activeVideoClip.label}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {activeAudioClips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/5"
                >
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300 font-medium">{activeAudioClips.length} audio</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Progress bar overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className="h-1.5 bg-zinc-800/60 cursor-pointer mx-4 mb-1 rounded-full overflow-hidden group hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-75 relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`absolute bottom-3 right-3 flex items-center gap-1 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Frame step buttons */}
        <button
          onClick={() => handleFrameStep(-1)}
          className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/60 transition-all border border-white/5"
          title="Previous frame (,)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleFrameStep(1)}
          className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/60 transition-all border border-white/5"
          title="Next frame (.)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-lg bg-black/40 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/60 transition-all border border-white/5"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-black/40 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-black/60 transition-all border border-white/5"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
