'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, Image } from '@/lib/store'
import ApiKeyInput from '@/components/ApiKeyInput'
import PromptInput from '@/components/PromptInput'
import ImageGrid from '@/components/ImageGrid'
import MotionStudio from '@/components/MotionStudio'
import ParticleBubble from '@/components/ParticleBubble'
import ViralArchitect from '@/components/ViralArchitect'
import { LayoutGrid, Clapperboard } from 'lucide-react'

export default function Home() {
  const { 
    apiKey, 
    prompt, 
    images, 
    isGeneratingImages, 
    setImages, 
    setIsGeneratingImages,
    selectedImageId,
    setSelectedImageId,
    updateImage,
    activeVideoTasks,
    removeVideoTask,
    setGeneratedVideo,
    activeNanoTasks,
    removeNanoTask,
    addImages
  } = useAppStore()
  
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [isStudioOpen, setIsStudioOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'mosaic' | 'architect'>('mosaic')

  // Handle nano banana polling
  useEffect(() => {
    if (activeNanoTasks.length === 0) return

    let isMounted = true
    const pollInterval = 5000 // 5 seconds

    const checkNanoTasks = async () => {
      if (!isMounted) return

      for (const task of activeNanoTasks) {
        try {
          const response = await fetch(`/api/nano-callback?taskId=${task.taskId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            cache: 'no-store'
          })
          const result = await response.json()

          if (!isMounted) return

          if (result.status === 'success' && result.imageUrls && result.imageUrls.length > 0) {
            // Create new image objects
            const newImages: Image[] = result.imageUrls.map((url: string, index: number) => ({
              id: `nano-${task.taskId}-${index}`,
              url,
              status: 'done',
              prompt: `Nano Banana edit of ${task.sourceImageId}`
            }))
            
            addImages(newImages)
            removeNanoTask(task.taskId)
          } else if (result.status === 'fail') {
            console.error(`Nano task ${task.taskId} failed:`, result.error)
            removeNanoTask(task.taskId)
            // Optionally notify user of failure
          }
          // If pending, do nothing, will check next interval
        } catch (error) {
          console.error(`Error checking nano task ${task.taskId}:`, error)
        }
      }
    }

    const timer = setInterval(checkNanoTasks, pollInterval)
    
    // Run immediately on mount/change
    checkNanoTasks()

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [activeNanoTasks, apiKey, removeNanoTask, addImages])

  // Handle video generation polling
  useEffect(() => {
    if (activeVideoTasks.length === 0) return

    let isMounted = true
    const pollInterval = 5000 // 5 seconds

    const checkVideoTasks = async () => {
      if (!isMounted) return

      for (const task of activeVideoTasks) {
        try {
          const response = await fetch(`/api/video-callback?taskId=${task.taskId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            cache: 'no-store'
          })
          const result = await response.json()

          if (!isMounted) return

          if (result.status === 'success' && result.videoUrl) {
            setGeneratedVideo(task.imageId, {
              url: result.videoUrl,
              taskId: task.taskId,
              model: (task as any).model || 'unknown'
            })
            removeVideoTask(task.taskId)
          } else if (result.status === 'fail') {
            console.error(`Video task ${task.taskId} failed:`, result.error)
            removeVideoTask(task.taskId)
            // Optionally notify user of failure
          }
          // If pending, do nothing, will check next interval
        } catch (error) {
          console.error(`Error checking video task ${task.taskId}:`, error)
        }
      }
    }

    const timer = setInterval(checkVideoTasks, pollInterval)
    
    // Run immediately on mount/change
    checkVideoTasks()

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [activeVideoTasks, apiKey, removeVideoTask, setGeneratedVideo])

  // Handle image generation
  useEffect(() => {
    const handleGenerate = async (event: Event) => {
      const customEvent = event as CustomEvent
      if (!apiKey || isGeneratingImages) return

      // Initialize with 60 empty slots
      const emptyImages: Image[] = Array.from({ length: 60 }, (_, i) => ({
        id: `empty-${i}`,
        url: '',
        status: 'loading' as const,
        prompt: customEvent.detail.prompt
      }))
      setImages(emptyImages)
      setIsGeneratingImages(true)
      
      try {
        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: customEvent.detail.prompt,
            apiKey
          })
        })

        const result = await response.json()

        if (result.success) {
          // Identify failed batches (those not in the tasks list)
          const successfulBatchIndices = new Set(result.tasks.map((t: any) => t.batchIndex))
          
          // Mark images from failed batches as error immediately
          for (let i = 0; i < 15; i++) {
            if (!successfulBatchIndices.has(i)) {
              for (let j = 0; j < 4; j++) {
                const imgIdx = i * 4 + j
                if (imgIdx < 60) {
                  updateImage(`empty-${imgIdx}`, { status: 'error' })
                }
              }
            }
          }

          // Start polling for results
          await pollForResults(result.tasks)
        } else {
          console.error('Generation failed:', result.error)
          setIsGeneratingImages(false)
        }
      } catch (error) {
        console.error('Error generating images:', error)
        setIsGeneratingImages(false)
      }
    }

    window.addEventListener('generate-images', handleGenerate)
    return () => window.removeEventListener('generate-images', handleGenerate)
  }, [apiKey, isGeneratingImages, setImages, updateImage])

  const pollForResults = async (tasks: any[]) => {
    // Keep track of which tasks are finished so we don't poll them again
    const completedTaskIds = new Set<string>()

    const checkTasks = async () => {
      let pendingCount = 0

      for (const task of tasks) {
        // Skip already completed tasks
        if (completedTaskIds.has(task.taskId)) continue

        try {
          const response = await fetch(`/api/midjourney-callback?taskId=${task.taskId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            cache: 'no-store'
          })
          const result = await response.json()

          if (result.status === 'success' && result.resultUrls) {
            // Mark task as completed
            completedTaskIds.add(task.taskId)

            // Update images with results
            result.resultUrls.forEach((url: string, index: number) => {
              const imageIndex = task.batchIndex * 4 + index
              if (imageIndex < 60) {
                updateImage(`empty-${imageIndex}`, {
                  id: `image-${task.taskId}-${index}`,
                  url,
                  status: 'done',
                  prompt
                })
              }
            })
          } else if (result.status === 'fail') {
            console.error(`Task ${task.taskId} failed`)
            
            // Mark task as completed (failed)
            completedTaskIds.add(task.taskId)

            // Mark as failed
            for (let i = 0; i < 4; i++) {
              const imageIndex = task.batchIndex * 4 + i
              if (imageIndex < 60) {
                updateImage(`empty-${imageIndex}`, {
                  status: 'error'
                })
              }
            }
          } else {
            // Still pending
            pendingCount++
          }
        } catch (error) {
          console.error('Error checking task:', error)
          // Treat error as pending to retry
          pendingCount++
        }
      }

      if (pendingCount > 0) {
        setTimeout(checkTasks, 2000) // Poll every 2 seconds
      } else {
        setIsGeneratingImages(false)
      }
    }

    checkTasks()
  }

  const handleImageClick = (image: Image) => {
    setSelectedImage(image)
    setSelectedImageId(image.id)
    setIsStudioOpen(true)
  }

  const handleCloseStudio = () => {
    setIsStudioOpen(false)
    setSelectedImage(null)
    setSelectedImageId(null)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* API Key Input */}
      <ApiKeyInput />

      {/* View Mode Toggle */}
      <div className="fixed top-6 right-6 z-50 flex bg-zinc-900/90 backdrop-blur-md rounded-full p-1.5 border border-zinc-800 shadow-xl">
        <button
          onClick={() => setViewMode('mosaic')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
            viewMode === 'mosaic' 
              ? 'bg-zinc-800 text-white shadow-sm' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Mosaic
        </button>
        <button
          onClick={() => setViewMode('architect')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
            viewMode === 'architect' 
              ? 'bg-amber-500/10 text-amber-400 shadow-sm ring-1 ring-amber-500/20' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Clapperboard className="w-4 h-4" />
          Architect
        </button>
      </div>

      {viewMode === 'architect' ? (
        <div className="min-h-screen pt-20">
          <ViralArchitect />
        </div>
      ) : (
        <>
          {/* Main Content */}
          <div className="relative min-h-screen">
            {/* Empty State with Particle Bubble */}
            {images.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <ParticleBubble />
                <div className="relative z-20 text-center p-8 bg-zinc-950/20 backdrop-blur-sm rounded-3xl border border-zinc-800/50">
                  <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">MotionMosaic</h1>
                  <p className="text-zinc-300 text-xl font-light">Describe your vision. Watch it come to life.</p>
                </div>
              </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10 pt-4"
              >
                <ImageGrid onImageClick={handleImageClick} />
              </motion.div>
            )}

            {/* Generation Counter */}
            {isGeneratingImages && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
                <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-full px-6 py-3 text-sm text-white shadow-lg flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Dreaming up your variations...
                </div>
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <PromptInput />

          {/* Motion Studio Modal */}
          <AnimatePresence>
            {isStudioOpen && (
              <MotionStudio
                isOpen={isStudioOpen}
                onClose={handleCloseStudio}
                selectedImage={selectedImage}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

