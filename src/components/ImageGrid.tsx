'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Download, Eye } from 'lucide-react'

interface ImageGridProps {
  onImageClick: (image: any) => void
}

export default function ImageGrid({ onImageClick }: ImageGridProps) {
  const { images, activeVideoTasks, generatedVideos } = useAppStore()

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const itemVariant = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      filter: 'blur(10px)'
    },
    show: { 
      opacity: 1, 
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.5,
        ease: "easeOut" as const
      }
    }
  }

  const loadingSkeleton = (
    <div className="w-full h-full bg-zinc-800 rounded-lg animate-pulse" />
  )

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2 p-2 pb-24">
      {images.map((image, index) => {
        const isGeneratingVideo = activeVideoTasks.some(t => t.imageId === image.id)
        const hasGeneratedVideo = !!generatedVideos[image.id]
        const showGlow = isGeneratingVideo || hasGeneratedVideo
        
        return (
        <motion.div
          key={image.id}
          variants={itemVariant}
          layoutId={`image-${image.id}`}
          className={`group relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 cursor-pointer ${
            showGlow ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : ''
          }`}
          onClick={() => image.status === 'done' && onImageClick(image)}
        >
          {showGlow && (
            <div className="absolute inset-0 z-20 pointer-events-none rounded-lg border-2 border-amber-500/50 animate-pulse" />
          )}

          {image.status === 'loading' ? (
            <div className="w-full h-full bg-zinc-800 rounded-lg animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : image.status === 'error' ? (
            <div className="w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center">
              <div className="text-zinc-600 text-xs text-center px-2">Failed to load</div>
            </div>
          ) : (
            <>
              <img
                src={image.url}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                alt={image.prompt || 'Generated image'}
              />
              
              {/* Hover Overlay - Desktop Only */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center md:flex">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20">
                    <Eye className="w-3 h-3 inline mr-1" />
                    View
                  </span>
                </div>
              </div>

              {/* Download Button - Always visible on mobile, hover on desktop */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Download functionality
                  const link = document.createElement('a')
                  link.href = image.url
                  link.download = `motion-mosaic-${image.id}.jpg`
                  link.click()
                }}
                className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100 md:bg-zinc-800/80"
              >
                <Download className="w-3 h-3 text-white" />
              </button>
            </>
          )}
        </motion.div>
        )
      })}
    </div>
  )
}
