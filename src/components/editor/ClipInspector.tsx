'use client'

import { useEditorStore } from '@/lib/editorStore'
import { useToastStore } from '@/lib/toastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Film, Volume2, Type, Scissors, Copy, Trash2, Settings2 } from 'lucide-react'

export default function ClipInspector() {
  const {
    clips, selectedClipId, setSelectedClipId,
    updateClip, trimClip, removeClip, duplicateClip, splitClip,
    currentTime, getCachedUrl, project, setProject, selectedClipIds,
  } = useEditorStore()
  const { addToast } = useToastStore()

  const clip = clips.find(c => c.id === selectedClipId)

  if (!clip) {
    return (
      <div className="h-full bg-zinc-900/80 border-l border-zinc-800/60 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-zinc-800/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Settings2 className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Project Settings</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Resolution</label>
              <span className="text-xs text-zinc-300 font-mono">{project.width}×{project.height}</span>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">FPS</label>
              <input
                type="number"
                value={project.fps}
                onChange={(e) => setProject({ fps: parseInt(e.target.value) || 30 })}
                min={1}
                max={120}
                className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-white text-right font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Clips</label>
              <span className="text-xs text-zinc-300 font-mono">{clips.length}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-zinc-500 text-sm">Select a clip to inspect</p>
            <p className="text-zinc-600 text-xs mt-1">Click any clip on the timeline</p>
          </div>
        </div>
      </div>
    )
  }

  const typeColors = {
    video: { accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    audio: { accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    text: { accent: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  }
  const colors = typeColors[clip.type]
  const TypeIcon = clip.type === 'video' ? Film : clip.type === 'audio' ? Volume2 : Type

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}.${Math.floor((t % 1) * 10)}`

  return (
    <motion.div
      key={clip.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full bg-zinc-900/80 border-l border-zinc-800/60 flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <TypeIcon className={`w-4 h-4 ${colors.accent}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white truncate max-w-[160px]">{clip.label}</h3>
            <p className="text-[10px] text-zinc-500 capitalize">{clip.type} clip</p>
          </div>
        </div>
        <button
          onClick={() => setSelectedClipId(null)}
          className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="p-3 border-b border-zinc-800/40 flex gap-1">
        <button
          onClick={() => splitClip(clip.id, currentTime)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-all"
          title="Split at playhead (S)"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="flex items-center gap-1">Split <kbd className="text-[8px] text-zinc-600 font-mono">S</kbd></span>
        </button>
        <button
          onClick={() => duplicateClip(clip.id)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-all"
          title="Duplicate (D)"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="flex items-center gap-1">Copy <kbd className="text-[8px] text-zinc-600 font-mono">D</kbd></span>
        </button>
        <button
          onClick={() => removeClip(clip.id)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs transition-all"
          title="Delete (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="flex items-center gap-1">Delete <kbd className="text-[8px] text-red-400/50 font-mono">⌫</kbd></span>
        </button>
      </div>

      {/* Timing */}
      <div className="p-4 border-b border-zinc-800/40">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Timing</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Start</label>
            <input
              type="number"
              value={Number(clip.startTime.toFixed(1))}
              onChange={(e) => updateClip(clip.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })}
              step={0.1}
              min={0}
              className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-white text-right font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Duration</label>
            <span className="text-xs text-zinc-300 font-mono">{clip.duration.toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">End</label>
            <span className="text-xs text-zinc-300 font-mono">{(clip.startTime + clip.duration).toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Trim */}
      <div className="p-4 border-b border-zinc-800/40">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Trim</h4>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400">Trim Start</label>
              <span className="text-[10px] text-zinc-600 font-mono">{clip.trimStart.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={clip.originalDuration - clip.trimEnd - 0.1}
              step={0.1}
              value={clip.trimStart}
              onChange={(e) => trimClip(clip.id, parseFloat(e.target.value), clip.trimEnd)}
              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400">Trim End</label>
              <span className="text-[10px] text-zinc-600 font-mono">{clip.trimEnd.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={clip.originalDuration - clip.trimStart - 0.1}
              step={0.1}
              value={clip.trimEnd}
              onChange={(e) => trimClip(clip.id, clip.trimStart, parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            />
          </div>
          {/* Visual trim bar */}
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden relative">
            <div
              className={`absolute top-0 bottom-0 rounded-full ${clip.type === 'video' ? 'bg-purple-500/40' : clip.type === 'audio' ? 'bg-emerald-500/40' : 'bg-sky-500/40'}`}
              style={{
                left: `${(clip.trimStart / clip.originalDuration) * 100}%`,
                right: `${(clip.trimEnd / clip.originalDuration) * 100}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-zinc-600 font-mono">
            <span>0s</span>
            <span>{clip.originalDuration.toFixed(1)}s original</span>
          </div>
        </div>
      </div>

      {/* Volume (for video / audio) */}
      {(clip.type === 'video' || clip.type === 'audio') && (
        <div className="p-4 border-b border-zinc-800/40">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Audio</h4>
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={clip.volume}
              onChange={(e) => updateClip(clip.id, { volume: parseFloat(e.target.value) })}
              className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            />
            <span className="text-xs text-zinc-400 font-mono w-8 text-right">{Math.round(clip.volume * 100)}%</span>
          </div>
        </div>
      )}

      {/* Text properties */}
      {clip.type === 'text' && (
        <div className="p-4 border-b border-zinc-800/40">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Text</h4>
          <div className="space-y-3">
            <textarea
              value={clip.text || ''}
              onChange={(e) => updateClip(clip.id, { text: e.target.value })}
              placeholder="Enter overlay text..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Size</label>
              <input
                type="number"
                value={clip.fontSize || 24}
                onChange={(e) => updateClip(clip.id, { fontSize: parseInt(e.target.value) || 24 })}
                min={8}
                max={120}
                className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-white text-right font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Color</label>
              <input
                type="color"
                value={clip.color || '#ffffff'}
                onChange={(e) => updateClip(clip.id, { color: e.target.value })}
                className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail preview for video */}
      {clip.type === 'video' && clip.thumbnailUrl && (
        <div className="p-4">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Preview</h4>
          <div className="aspect-[9/16] rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-950">
            {clip.sourceUrl ? (
              <video src={getCachedUrl(clip.sourceUrl)} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
