'use client'

import { useState, useEffect } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import { useToastStore } from '@/lib/toastStore'
import {
  Undo2, Redo2, Scissors, Copy, Trash2, Play, Pause, SkipBack, SkipForward,
  Download, Magnet, ZoomIn, ZoomOut, ArrowLeft, Volume2, Maximize2, Rows3
} from 'lucide-react'

interface EditorToolbarProps {
  onExport: () => void
  onBack: () => void
  children?: React.ReactNode
}

export default function EditorToolbar({ onExport, onBack, children }: EditorToolbarProps) {
  const [mounted, setMounted] = useState(false)
  const {
    isPlaying, setIsPlaying, currentTime, setCurrentTime,
    selectedClipId, removeClip, splitClip, duplicateClip,
    undo, redo, historyIndex, history,
    zoom, setZoom, snapEnabled, setSnapEnabled,
    rippleEnabled, setRippleEnabled,
    getTimelineDuration, playbackRate, setPlaybackRate,
    clips,
  } = useEditorStore()
  const { addToast } = useToastStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const totalDuration = getTimelineDuration()

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 100)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const handleSplit = () => {
    if (selectedClipId) { splitClip(selectedClipId, currentTime); addToast('Clip split') }
  }

  const handleDuplicate = () => {
    if (selectedClipId) { duplicateClip(selectedClipId); addToast('Clip duplicated') }
  }

  const handleDelete = () => {
    if (selectedClipId) { removeClip(selectedClipId); addToast('Clip deleted') }
  }

  const handleFitToView = () => {
    if (clips.length === 0) return
    const maxEnd = Math.max(...clips.map(c => c.startTime + c.duration))
    if (maxEnd <= 0) return
    // Estimate available width (~80% of viewport)
    const approxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.55 : 800
    const fitZoom = Math.max(20, Math.min(300, approxWidth / maxEnd))
    setZoom(fitZoom)
    addToast('Zoomed to fit')
  }

  return (
    <div className="h-12 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/60 flex items-center px-3 gap-1 shrink-0">
      {/* Back */}
      <button
        onClick={onBack}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all mr-1"
        title="Back to project"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {children}

      <div className="w-px h-6 bg-zinc-800 mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={historyIndex < 0}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={redo}
        disabled={historyIndex >= history.length - 1}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-zinc-800 mx-1" />

      {/* Clip actions */}
      <button
        onClick={handleSplit}
        disabled={!selectedClipId}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="Split at playhead"
      >
        <Scissors className="w-4 h-4" />
      </button>
      <button
        onClick={handleDuplicate}
        disabled={!selectedClipId}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="Duplicate clip"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={handleDelete}
        disabled={!selectedClipId}
        className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="Delete clip"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-zinc-800 mx-1" />

      {/* Snap toggle */}
      <button
        onClick={() => setSnapEnabled(!snapEnabled)}
        className={`p-2 rounded-lg transition-all ${
          snapEnabled
            ? 'text-amber-400 bg-amber-500/10'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
        }`}
        title={`Snap ${snapEnabled ? 'on' : 'off'}`}
      >
        <Magnet className="w-4 h-4" />
      </button>

      {/* Ripple editing toggle */}
      <button
        onClick={() => { setRippleEnabled(!rippleEnabled); addToast(rippleEnabled ? 'Ripple off' : 'Ripple on') }}
        className={`p-2 rounded-lg transition-all ${
          rippleEnabled
            ? 'text-purple-400 bg-purple-500/10'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
        }`}
        title={`Ripple edit ${rippleEnabled ? 'on' : 'off'}`}
      >
        <Rows3 className="w-4 h-4" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Playback controls - center */}
      <div className="flex items-center gap-1 bg-zinc-800/50 rounded-xl px-2 py-1">
        <button
          onClick={() => setCurrentTime(0)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-all"
          title="Go to start"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button
          onClick={() => setCurrentTime(totalDuration)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-all"
          title="Go to end"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Time display */}
        <div className="ml-2 font-mono text-xs text-zinc-300 tabular-nums min-w-[100px]">
          {mounted ? formatTime(currentTime) : '00:00.00'} <span className="text-zinc-600">/</span> {mounted ? formatTime(totalDuration) : '00:30.00'}
        </div>

        {/* Playback speed */}
        <button
          onClick={() => {
            const rates = [0.5, 1, 1.5, 2]
            const idx = rates.indexOf(playbackRate)
            setPlaybackRate(rates[(idx + 1) % rates.length])
          }}
          className="ml-1 px-2 py-1 rounded text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 transition-all"
        >
          {playbackRate}x
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls with slider */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(zoom - 15)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <input
          type="range"
          min={20}
          max={300}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-20 h-1 appearance-none bg-zinc-700 rounded-full cursor-pointer accent-amber-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:cursor-pointer"
          title={`Zoom: ${Math.round(zoom)}px/s`}
        />
        <button
          onClick={() => setZoom(zoom + 15)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleFitToView}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all ml-0.5"
          title="Fit to view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-6 bg-zinc-800 mx-1" />

      {/* Export */}
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
    </div>
  )
}
