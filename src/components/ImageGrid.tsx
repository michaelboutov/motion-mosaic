'use client'

import { motion } from 'framer-motion'
import { useAppStore, Image } from '@/lib/store'
import { Download, Eye, RefreshCw, CheckSquare, Square, Trash2, X } from 'lucide-react'
import { useState, useCallback } from 'react'
import { downloadFile } from '@/lib/utils'
import { refreshTaskImages, extractTaskId } from '@/lib/refreshTaskImages'

interface ImageGridProps {
  onImageClick: (image: any) => void
}

export type ImageFilter = 'all' | 'completed' | 'failed' | 'has-video'

export default function ImageGrid({ onImageClick }: ImageGridProps) {
  const { images, activeVideoTasks, generatedVideos, kieApiKey, updateImage, setImages } = useAppStore()
  const [refreshingImages, setRefreshingImages] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<ImageFilter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredImages = images.filter((img) => {
    switch (filter) {
      case 'completed': return img.status === 'done'
      case 'failed': return img.status === 'error'
      case 'has-video': return !!generatedVideos[img.id]
      default: return true
    }
  })

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectAll = () => {
    setSelectedIds(new Set(filteredImages.filter(i => i.status === 'done').map(i => i.id)))
  }

  const handleBulkDownload = () => {
    const toDownload = images.filter(i => selectedIds.has(i.id) && i.status === 'done' && i.url)
    toDownload.forEach((img, i) => {
      setTimeout(() => downloadFile(img.url, `motion-mosaic-${img.id}.jpg`), i * 300)
    })
  }

  const handleBulkDelete = () => {
    setImages(images.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleImageError = async (image: Image) => {
    const taskId = extractTaskId(image)
    if (!kieApiKey || !taskId || refreshingImages.has(image.id)) return
    
    console.log(`Image ${image.id} failed to load, attempting to refresh...`)
    setRefreshingImages(prev => new Set(prev).add(image.id))
    
    try {
      const result = await refreshTaskImages({
        taskId,
        isMidjourney: image.id.startsWith('mj-'),
        images: [image],
        apiKey: kieApiKey,
      })
      if (result.success && result.updatedImages) {
        const updated = result.updatedImages.find(i => i.id === image.id)
        if (updated) {
          updateImage(image.id, { url: updated.url, taskId: updated.taskId })
          console.log(`Image ${image.id} URL refreshed successfully`)
        }
      }
    } catch (error) {
      console.error(`Failed to refresh image ${image.id}:`, error)
    } finally {
      setRefreshingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(image.id)
        return newSet
      })
    }
  }

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

  const filterButtons: { key: ImageFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: images.length },
    { key: 'completed', label: 'Completed', count: images.filter(i => i.status === 'done').length },
    { key: 'failed', label: 'Failed', count: images.filter(i => i.status === 'error').length },
    { key: 'has-video', label: 'Has Video', count: images.filter(i => !!generatedVideos[i.id]).length },
  ]

  return (
    <div>
      {/* Filter & Bulk Toolbar */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filterButtons.map(fb => (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === fb.key
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {fb.label}
              <span className={`ml-1.5 text-[10px] tabular-nums ${
                filter === fb.key ? 'text-zinc-400' : 'text-zinc-600'
              }`}>{fb.count}</span>
            </button>
          ))}
        </div>

        {!selectMode ? (
          <button
            onClick={() => setSelectMode(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-all whitespace-nowrap flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Select
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="px-2.5 py-1 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 transition-all uppercase tracking-wider">
              All
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={selectedIds.size === 0}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30"
              title="Download selected"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="p-1.5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
              title="Delete selected"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-zinc-500 tabular-nums min-w-[2rem] text-center">{selectedIds.size}</span>
            <button
              onClick={exitSelectMode}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2 p-2 pb-24">
      {filteredImages.map((image, index) => {
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
          onClick={() => {
            if (selectMode && image.status === 'done') { toggleSelect(image.id); return }
            if (image.status === 'done') onImageClick(image)
          }}
        >
          {showGlow && (
            <div className="absolute inset-0 z-20 pointer-events-none rounded-lg border-2 border-amber-500/50 animate-pulse" />
          )}

          {image.status === 'loading' ? (
            <div className="w-full h-full bg-zinc-800 rounded-lg animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : image.status === 'error' ? (
            <button
              onClick={() => handleImageError(image)}
              className="w-full h-full bg-zinc-800 rounded-lg flex flex-col items-center justify-center gap-2 group/retry hover:bg-zinc-750 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-600 group-hover/retry:text-amber-400 transition-colors ${refreshingImages.has(image.id) ? 'animate-spin' : ''}`} />
              <div className="text-zinc-600 group-hover/retry:text-zinc-400 text-xs text-center px-2 transition-colors">
                {refreshingImages.has(image.id) ? 'Retrying...' : 'Tap to retry'}
              </div>
            </button>
          ) : (
            <>
              <img
                src={image.url}
                loading="lazy"
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${refreshingImages.has(image.id) ? 'opacity-50' : ''}`}
                alt={image.prompt || 'Generated image'}
                onError={() => handleImageError(image)}
              />
              
              {/* Hover Overlay - Desktop Only */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center md:flex">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20">
                    <Eye className="w-3 h-3 inline mr-1" />
                    View
                  </span>
                </div>
              </div>

              {/* Select checkbox overlay */}
              {selectMode && image.status === 'done' && (
                <div className="absolute top-2 left-2 z-10">
                  {selectedIds.has(image.id)
                    ? <CheckSquare className="w-5 h-5 text-amber-400 drop-shadow" />
                    : <Square className="w-5 h-5 text-white/60 drop-shadow" />
                  }
                </div>
              )}

              {/* Download Button - Always visible on mobile, hover on desktop */}
              {!selectMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadFile(image.url, `motion-mosaic-${image.id}.jpg`)
                  }}
                  className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity md:bg-zinc-800/80"
                >
                  <Download className="w-3 h-3 text-white" />
                </button>
              )}
            </>
          )}
        </motion.div>
        )
      })}
    </div>
    </div>
  )
}
