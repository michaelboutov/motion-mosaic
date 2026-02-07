'use client'

import { motion } from 'framer-motion'
import { Film, CheckCircle, Loader2, AlertCircle, ImageIcon } from 'lucide-react'

interface TimelineScene {
  id: number
  visual: string
  tool: 'Midjourney' | 'Nano Banana'
  status: 'pending' | 'generating' | 'done' | 'error'
  images: { id: string; url: string; status: string }[]
  selectedImageId?: string
  video?: { url: string; status: string }
}

interface TimelineViewProps {
  scenes: TimelineScene[]
  onSceneClick: (sceneId: number) => void
  activeSceneId: number | null
}

export default function TimelineView({ scenes, onSceneClick, activeSceneId }: TimelineViewProps) {
  const getThumbUrl = (scene: TimelineScene) => {
    if (scene.selectedImageId) {
      const img = scene.images.find((i) => i.id === scene.selectedImageId)
      if (img?.url) return img.url
    }
    const done = scene.images.find((i) => i.status === 'done' && i.url)
    return done?.url || null
  }

  return (
    <div className="p-4 border-b border-zinc-800/50 bg-zinc-950/30">
      <div className="flex items-center gap-2 mb-3">
        <Film className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Storyboard Timeline</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {scenes.map((scene, idx) => {
          const thumb = getThumbUrl(scene)
          const isActive = activeSceneId === scene.id
          return (
            <motion.button
              key={scene.id}
              onClick={() => onSceneClick(scene.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex-shrink-0 w-28 rounded-xl overflow-hidden border-2 transition-all duration-200 group ${
                isActive
                  ? 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'border-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              {/* Thumbnail */}
              <div className="aspect-[9/16] bg-zinc-900 relative">
                {thumb ? (
                  <img src={thumb} alt={scene.visual} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-zinc-700" />
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-1.5 right-1.5">
                  {scene.status === 'done' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 drop-shadow-lg" />
                  ) : scene.status === 'generating' ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin drop-shadow-lg" />
                  ) : scene.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-500 drop-shadow-lg" />
                  ) : null}
                </div>

                {/* Video indicator */}
                {scene.video?.status === 'done' && (
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur-sm rounded text-[8px] font-bold text-white uppercase">
                    Video
                  </div>
                )}

                {/* Connector line */}
                {idx < scenes.length - 1 && (
                  <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-zinc-700 z-10" />
                )}
              </div>

              {/* Label */}
              <div className="px-2 py-1.5 bg-zinc-900/90 backdrop-blur-sm">
                <div className="text-[10px] font-bold text-zinc-400 mb-0.5">Scene {scene.id}</div>
                <div className="text-[9px] text-zinc-600 truncate">{scene.visual}</div>
                <div className="text-[8px] text-zinc-700 font-mono mt-0.5">3s</div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
