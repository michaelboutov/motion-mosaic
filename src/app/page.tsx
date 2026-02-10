'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, Image } from '@/lib/store'
import { useStudioHandlers } from '@/lib/useStudioHandlers'
import { useMosaicPolling } from '@/lib/useMosaicPolling'
import { startPolling } from '@/lib/usePoll'
import ApiKeyInput from '@/components/ApiKeyInput'
import PromptInput, { GenerationSettings } from '@/components/PromptInput'
import ImageGrid from '@/components/ImageGrid'
import MotionStudio from '@/components/MotionStudio'
import ParticleBubble from '@/components/ParticleBubble'
import ViralArchitect from '@/components/ViralArchitect'
import DirectorChat from '@/components/DirectorChat'
import { LayoutGrid, Clapperboard, Settings, MessageCircle, MonitorPlay, ExternalLink } from 'lucide-react'

export default function Home() {
  const { 
    kieApiKey, 
    prompt, 
    images, 
    isGeneratingImages, 
    setImages, 
    setIsGeneratingImages,
    updateImage,
  } = useAppStore()
  
  const directorIsOpen = useAppStore((s) => s.directorChat.isOpen)
  const toggleDirectorChat = useAppStore((s) => s.toggleDirectorChat)
  const { selectedImage, isStudioOpen, handleImageClick, handleCloseStudio, handleNavigate } = useStudioHandlers()
  const [viewMode, setViewMode] = useState<'mosaic' | 'architect'>('mosaic')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Nano + Video polling (extracted to dedicated hook)
  useMosaicPolling()

  // Auto-open settings on first visit if no API key
  useEffect(() => {
    if (!kieApiKey && images.length === 0) {
      setIsSettingsOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle image generation triggered by PromptInput
  const handleGenerate = async (generationPrompt: string, settings?: GenerationSettings) => {
    if (!kieApiKey || isGeneratingImages) return

    // Initialize with 60 empty slots
    const emptyImages: Image[] = Array.from({ length: 60 }, (_, i) => ({
      id: `empty-${i}`,
      url: '',
      status: 'loading' as const,
      prompt: generationPrompt
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
          prompt: generationPrompt,
          apiKey: kieApiKey,
          ...(settings && {
            aspectRatio: settings.aspectRatio,
            speed: settings.speed,
            variety: settings.variety,
          })
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

  const pollForResults = (tasks: any[]) => {
    const completedTaskIds = new Set<string>()

    startPolling({
      intervalMs: 2000,
      maxAttempts: 300,
      onTimeout: () => setIsGeneratingImages(false),
      checkFn: async () => {
        let pendingCount = 0

        for (const task of tasks) {
          if (completedTaskIds.has(task.taskId)) continue

          try {
            const response = await fetch(`/api/midjourney-callback?taskId=${task.taskId}`, {
              headers: { Authorization: `Bearer ${kieApiKey}` },
              cache: 'no-store',
            })
            const result = await response.json()

            if (result.status === 'success' && result.resultUrls) {
              completedTaskIds.add(task.taskId)
              result.resultUrls.forEach((url: string, index: number) => {
                const imageIndex = task.batchIndex * 4 + index
                if (imageIndex < 60) {
                  updateImage(`empty-${imageIndex}`, {
                    id: `image-${task.taskId}-${index}`,
                    url,
                    status: 'done',
                    prompt,
                  })
                }
              })
            } else if (result.status === 'fail') {
              completedTaskIds.add(task.taskId)
              for (let i = 0; i < 4; i++) {
                const imageIndex = task.batchIndex * 4 + i
                if (imageIndex < 60) {
                  updateImage(`empty-${imageIndex}`, { status: 'error' })
                }
              }
            } else {
              pendingCount++
            }
          } catch (error) {
            console.error('Error checking task:', error)
            pendingCount++
          }
        }

        if (pendingCount === 0) {
          setIsGeneratingImages(false)
          return 'done'
        }
        return 'continue'
      },
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* API Key Input */}
      <ApiKeyInput isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* View Mode Toggle */}
      <div className={`fixed top-6 z-50 flex bg-zinc-900/90 backdrop-blur-md rounded-full p-1.5 border border-zinc-800 shadow-xl items-center gap-1 transition-all duration-300 ${directorIsOpen ? 'right-[416px]' : 'right-6'}`}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={toggleDirectorChat}
          className={`p-2.5 rounded-full transition-all ${
            directorIsOpen
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
          title="Director AI"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        
        <div className="w-px h-4 bg-zinc-800 mx-1" />

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

        <div className="w-px h-4 bg-zinc-800 mx-1" />

        <button
          onClick={() => { window.location.href = '/editor' }}
          className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15 ring-1 ring-purple-500/20 hover:ring-purple-500/40"
          title="Open Editor"
        >
          <MonitorPlay className="w-4 h-4" />
          Editor
          <ExternalLink className="w-3 h-3 opacity-50" />
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
            <AnimatePresence>
              {images.length === 0 && !isGeneratingImages && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  <ParticleBubble />
                  <div className="relative z-20 text-center p-8 bg-zinc-950/20 backdrop-blur-sm rounded-3xl border border-zinc-800/50">
                    <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">MotionMosaic</h1>
                    <p className="text-zinc-300 text-xl font-light mb-6">Describe your vision. Watch it come to life.</p>
                    
                    {!kieApiKey && (
                      <p className="text-xs text-zinc-500 mb-6">
                        Add your API key in <button onClick={() => setIsSettingsOpen(true)} className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">Settings (⚙️)</button> to get started
                      </p>
                    )}

                    <div className="mt-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Quick Start Templates</p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                        {[
                          { icon: '🌃', label: 'Cyberpunk street food vendor in rain' },
                          { icon: '🏔️', label: 'Ethereal mountain temple at sunrise' },
                          { icon: '🌊', label: 'Underwater bioluminescent coral city' },
                          { icon: '🚀', label: 'Retro-futuristic space station lounge' },
                          { icon: '🌸', label: 'Cherry blossom samurai duel at dusk' },
                          { icon: '🔮', label: 'Neon witch apothecary in a dark alley' },
                        ].map((t) => (
                          <button
                            key={t.label}
                            onClick={() => useAppStore.getState().setPrompt(t.label)}
                            className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-amber-500/30 rounded-full text-sm text-zinc-300 hover:text-white transition-all"
                          >
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generating skeleton — shown between empty state fadeout and grid fadein */}
            <AnimatePresence>
              {images.length === 0 && isGeneratingImages && (
                <motion.div
                  key="generating-skeleton"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4"
                >
                  <div className="w-12 h-12 border-3 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm font-medium animate-pulse">Generating your mosaic...</p>
                </motion.div>
              )}
            </AnimatePresence>

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
          <PromptInput onGenerate={handleGenerate} />

          {/* Motion Studio Modal */}
          <AnimatePresence>
            {isStudioOpen && (
              <MotionStudio
                isOpen={isStudioOpen}
                onClose={handleCloseStudio}
                selectedImage={selectedImage}
                onNavigate={handleNavigate}
              />
            )}
          </AnimatePresence>
        </>
      )}
      {/* Director AI Chat Panel */}
      <DirectorChat viewMode={viewMode} />
    </div>
  )
}

