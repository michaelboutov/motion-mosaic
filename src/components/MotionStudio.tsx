'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, Image } from '@/lib/store'
import { X, Download, Share, Sparkles, Wand2, Users, Plus, Link2, ImageIcon, ChevronDown, ChevronLeft, ChevronRight, SplitSquareHorizontal, Clapperboard } from 'lucide-react'
import ComparisonSlider from '@/components/ComparisonSlider'
import { downloadFile } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import VideoSettings, { VideoSettingsValues } from '@/components/VideoSettings'
import AnimatedSpinner from '@/components/AnimatedSpinner'
import { useEditorStore } from '@/lib/editorStore'
import { probeVideoDuration } from '@/lib/probeVideoDuration'

interface MotionStudioProps {
  isOpen: boolean
  onClose: () => void
  selectedImage: Image | null
  onNavigate?: (image: Image) => void
}

export default function MotionStudio({ isOpen, onClose, selectedImage, onNavigate }: MotionStudioProps) {
  const { 
    generatedVideos, 
    activeVideoTasks,
    addVideoTask,
    setGeneratedVideo,
    kieApiKey,
    addNanoTask,
    architect,
    swapPrompt,
    setSwapPrompt
  } = useAppStore()
  
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'source' | 'output'>('source')
  const [activeTool, setActiveTool] = useState<'video' | 'nano' | 'swap'>('video')
  const [localIsGenerating, setLocalIsGenerating] = useState(false)
  const [nanoPrompt, setNanoPrompt] = useState('')

  // Video Generation State
  const [videoSettings, setVideoSettings] = useState<VideoSettingsValues>({
    model: 'seedance',
    prompt: '',
    grokDuration: '6',
    grokMode: 'normal',
  })

  const videoData = selectedImage ? generatedVideos[selectedImage.id] : null
  const videoUrl = videoData?.url
  
  // We track "last generated model" in local state for immediate feedback, 
  // but we prefer the stored model if available.
  const [lastGeneratedModel, setLastGeneratedModel] = useState<'seedance' | 'grok' | null>(null)
  const currentVideoModel = videoData?.model || lastGeneratedModel

  const isGeneratingThisVideo = selectedImage ? activeVideoTasks.some(t => t.imageId === selectedImage.id) : false

  const [showRegenSettings, setShowRegenSettings] = useState(false)

  // Character Swap State
  const [swapCharacterRefs, setSwapCharacterRefs] = useState<{ id: string; url: string; label: string; prompt: string }[]>([])

  // Sync swap prompt from store (set by Director AI) into character ref prompts
  useEffect(() => {
    if (swapPrompt) {
      setSwapCharacterRefs(prev =>
        prev.length > 0
          ? prev.map(r => ({ ...r, prompt: swapPrompt }))
          : prev
      )
      setSwapPrompt('')
    }
  }, [swapPrompt, setSwapPrompt])
  const [swapCharacterCount, setSwapCharacterCount] = useState(1)
  const [swapImportUrl, setSwapImportUrl] = useState('')
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null)
  const [swapModel, setSwapModel] = useState<'nano' | 'gpt'>('nano')
  const [showComparison, setShowComparison] = useState(false)

  // Find which scene owns the selected image (for grokMotion sync)
  const ownerScene = selectedImage
    ? architect.scenes.find(s => s.images.some(img => img.id === selectedImage.id))
    : undefined

  // All scene images available for picking
  const allSceneImages = architect.scenes.flatMap(scene =>
    scene.images
      .filter(img => img.status === 'done' && img.url)
      .map(img => ({ ...img, sceneId: scene.id }))
  )

  // Navigation: collect all navigable images (scene images or mosaic images from store)
  const { images: mosaicImages } = useAppStore()
  const navigableImages = allSceneImages.length > 0
    ? allSceneImages.filter(img => img.status === 'done' && img.url)
    : mosaicImages.filter(img => img.status === 'done' && img.url)
  const currentIndex = selectedImage ? navigableImages.findIndex(img => img.id === selectedImage.id) : -1
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex >= 0 && currentIndex < navigableImages.length - 1

  const goToPrev = () => {
    if (canGoPrev && onNavigate) onNavigate(navigableImages[currentIndex - 1])
  }
  const goToNext = () => {
    if (canGoNext && onNavigate) onNavigate(navigableImages[currentIndex + 1])
  }

  // Keyboard arrow navigation
  useEffect(() => {
    if (!isOpen || !onNavigate) return
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, currentIndex, navigableImages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find the source image if current image is a nano/swap result
  const sourceImageForComparison = (() => {
    if (!selectedImage) return null
    // Nano edits have prompt like "Nano Banana edit of {sourceImageId}"
    const nanoMatch = selectedImage.prompt?.match(/^Nano Banana edit of (.+)$/)
    if (nanoMatch) {
      const sourceId = nanoMatch[1]
      // Look in mosaic images and scene images
      const fromMosaic = mosaicImages.find(img => img.id === sourceId && img.status === 'done')
      if (fromMosaic) return fromMosaic
      for (const scene of architect.scenes) {
        const fromScene = scene.images.find(img => img.id === sourceId && img.status === 'done')
        if (fromScene) return fromScene
      }
    }
    return null
  })()

  // Initialize prompts when selectedImage changes
  useEffect(() => {
    if (selectedImage) {
      // Prefer scene's grokMotion > image's videoPrompt > image's prompt
      const sceneMotion = ownerScene?.grokMotion
      setVideoSettings(prev => ({ ...prev, prompt: sceneMotion || selectedImage.videoPrompt || selectedImage.prompt || '' }))
      setNanoPrompt(selectedImage.prompt || '')
      setSwapCharacterRefs([])
      setSwapCharacterCount(1)
      setActiveSlotIndex(null)
      setShowComparison(false)
    }
  }, [selectedImage?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reactively sync when Director AI updates grokMotion on the owner scene
  const ownerGrokMotion = ownerScene?.grokMotion
  useEffect(() => {
    if (ownerGrokMotion) {
      setVideoSettings(prev => ({ ...prev, prompt: ownerGrokMotion }))
    }
  }, [ownerGrokMotion])

  const handleGenerateVideo = async () => {
    if (!selectedImage || !kieApiKey) return

    setLocalIsGenerating(true)
    setActiveTab('output')
    setActiveTool('video')
    setLastGeneratedModel(videoSettings.model)

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieApiKey}`
        },
        body: JSON.stringify({
          imageUrl: selectedImage.url,
          prompt: videoSettings.prompt || selectedImage.prompt || 'Animate this image',
          model: videoSettings.model === 'grok' ? 'grok-imagine/image-to-video' : 'bytedance/seedance-1.5-pro',
          ...(videoSettings.model === 'grok' && {
            duration: videoSettings.grokDuration,
            mode: videoSettings.grokMode
          })
        })
      })

      const result = await response.json()

      if (result.success && result.taskId) {
        addVideoTask(result.taskId, selectedImage.id, videoSettings.model)
      } else {
        console.error('Video generation failed:', result.error)
      }
    } catch (error) {
      console.error('Error generating video:', error)
    } finally {
      setLocalIsGenerating(false)
    }
  }

  const handleUpscaleVideo = async () => {
    if (!selectedImage || !kieApiKey || !videoData?.taskId) {
      toast({ title: 'Cannot upscale', description: 'Missing video task ID. Please regenerate the video.', variant: 'warning' })
      return
    }

    setLocalIsGenerating(true)
    
    try {
      const response = await fetch('/api/upscale-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieApiKey}`
        },
        body: JSON.stringify({
          taskId: videoData.taskId
        })
      })

      const result = await response.json()

      if (result.success && result.taskId) {
        // We reuse addVideoTask for tracking upscale tasks too, 
        // effectively treating it as another video generation for this image.
        // The model 'grok-upscale' can be used to distinguish.
        addVideoTask(result.taskId, selectedImage.id, 'grok-upscale')
      } else {
        console.error('Upscale failed:', result.error)
        toast({ title: 'Upscale failed', description: result.error, variant: 'error' })
      }
    } catch (error) {
      console.error('Error starting upscale:', error)
      toast({ title: 'Error starting upscale', variant: 'error' })
    } finally {
      setLocalIsGenerating(false)
    }
  }

  const handleGenerateNano = async () => {
    if (!selectedImage || !kieApiKey) return

    setLocalIsGenerating(true)
    setActiveTab('output')
    setActiveTool('nano')

    try {
      const response = await fetch('/api/generate-nano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieApiKey}`
        },
        body: JSON.stringify({
          imageUrl: selectedImage.url,
          prompt: nanoPrompt || selectedImage.prompt || 'Edit this image',
          aspectRatio: '9:16',
          resolution: '2K',
          outputFormat: 'png'
        })
      })

      const result = await response.json()

      if (result.success && result.taskId) {
        addNanoTask(result.taskId, selectedImage.id)
        // Close studio or show notification? 
        // For now we just stay here, user can see the "Generating" state or we can close
        onClose() 
      } else {
        console.error('Nano generation failed:', result.error)
        toast({ title: 'Generation failed', description: result.error || 'Unknown error', variant: 'error' })
      }
    } catch (error) {
      console.error('Error generating nano edit:', error)
      toast({ title: 'Error generating nano edit', description: 'Please check console for details.', variant: 'error' })
    } finally {
      setLocalIsGenerating(false)
    }
  }

  const handleCharacterSwap = async () => {
    if (!selectedImage || !kieApiKey || swapCharacterRefs.length === 0) return

    setLocalIsGenerating(true)
    setActiveTab('output')

    let successCount = 0
    let failCount = 0

    // Fire a separate API call for each character
    for (const charRef of swapCharacterRefs) {
      try {
        const imageUrls = [selectedImage.url, charRef.url]
        const prompt = charRef.prompt || `change the character from the first image to the character from the second image, keep the style, pose, clothes, and composition from the first image`

        const apiRoute = swapModel === 'gpt' ? '/api/generate-gpt-image' : '/api/generate-nano'
        const bodyPayload = swapModel === 'gpt'
          ? { imageUrls, prompt, aspectRatio: '2:3', quality: 'high' }
          : { imageUrls, prompt, aspectRatio: '9:16', resolution: '2K', outputFormat: 'png' }

        const response = await fetch(apiRoute, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieApiKey}`
          },
          body: JSON.stringify(bodyPayload)
        })

        const result = await response.json()
        if (result.success && result.taskId) {
          addNanoTask(result.taskId, selectedImage.id)
          successCount++
        } else {
          failCount++
          console.error(`Swap failed for ${charRef.label}:`, result.error)
        }
      } catch (error) {
        failCount++
        console.error(`Error swapping ${charRef.label}:`, error)
      }
    }

    if (successCount > 0) {
      toast({ title: `${successCount} swap${successCount > 1 ? 's' : ''} started`, description: `${successCount} API call${successCount > 1 ? 's' : ''} queued. Results will appear in the main grid.`, variant: 'default' })
    }
    if (failCount > 0) {
      toast({ title: `${failCount} swap${failCount > 1 ? 's' : ''} failed`, variant: 'error' })
    }

    setLocalIsGenerating(false)
    if (successCount > 0) onClose()
  }

  const addCharacterRef = (id: string, url: string, label: string) => {
    if (activeSlotIndex === null) return
    const defaultPrompt = `change the character from the first image to the character from the second image, keep the style, pose, clothes, and composition from the first image`
    setSwapCharacterRefs(prev => {
      const updated = [...prev]
      updated[activeSlotIndex] = { id, url, label, prompt: prev[activeSlotIndex]?.prompt || defaultPrompt }
      return updated
    })
    setActiveSlotIndex(null)
  }

  const removeCharacterRef = (index: number) => {
    setSwapCharacterRefs(prev => prev.filter((_, i) => i !== index))
  }

  const handleImportSwapUrl = () => {
    if (!swapImportUrl.trim() || activeSlotIndex === null) return
    try {
      new URL(swapImportUrl)
    } catch {
      toast({ title: 'Invalid URL', variant: 'warning' })
      return
    }
    addCharacterRef(`import-${Date.now()}`, swapImportUrl.trim(), 'Imported')
    setSwapImportUrl('')
  }

  const handleDownload = downloadFile

  if (!isOpen || !selectedImage) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setActiveTool('video')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTool === 'video'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Video
            </button>
            <button
              onClick={() => setActiveTool('nano')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTool === 'nano'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Nano Edit
            </button>
            <button
              onClick={() => setActiveTool('swap')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTool === 'swap'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Character Swap
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm">
              Export All
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile Tabs */}
          <div className="flex md:hidden border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('source')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'source' 
                  ? 'text-white border-b-2 border-white' 
                  : 'text-zinc-400'
              }`}
            >
              Source Image
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'output' 
                  ? 'text-white border-b-2 border-white' 
                  : 'text-zinc-400'
              }`}
            >
              {activeTool === 'video' ? 'Generated Video' : activeTool === 'nano' ? 'Nano Edit' : 'Character Swap'}
            </button>
          </div>

          {/* LEFT: Source Image */}
          <div className={`flex-1 relative border-r border-zinc-800 flex items-center justify-center bg-zinc-900/50 ${
            activeTab === 'source' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="px-2 py-1 bg-black/50 backdrop-blur text-xs text-zinc-300 rounded border border-zinc-700">
                Source
              </span>
              {onNavigate && navigableImages.length > 1 && (
                <span className="px-2 py-1 bg-black/50 backdrop-blur text-xs text-zinc-500 rounded border border-zinc-700">
                  {currentIndex + 1} / {navigableImages.length}
                </span>
              )}
            </div>

            {/* Prev / Next navigation arrows */}
            {onNavigate && navigableImages.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  disabled={!canGoPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 transition-colors disabled:opacity-20 disabled:cursor-default"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canGoNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 transition-colors disabled:opacity-20 disabled:cursor-default"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            
            {selectedImage.url ? (
              showComparison && sourceImageForComparison ? (
                <ComparisonSlider
                  beforeSrc={sourceImageForComparison.url}
                  afterSrc={selectedImage.url}
                  beforeLabel="Original"
                  afterLabel="Edited"
                />
              ) : (
                <motion.img
                  layoutId={`image-${selectedImage.id}`}
                  src={selectedImage.url}
                  className="max-h-[80vh] max-w-[90%] object-contain shadow-2xl rounded-lg touch-none"
                  alt={selectedImage.prompt || 'Source image'}
                  drag={onNavigate && navigableImages.length > 1 ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.3}
                  onDragEnd={(_e, info) => {
                    const swipeThreshold = 80
                    if (info.offset.x < -swipeThreshold && canGoNext) goToNext()
                    else if (info.offset.x > swipeThreshold && canGoPrev) goToPrev()
                  }}
                />
              )
            ) : (
              <div className="max-h-[80vh] max-w-[90%] flex flex-col items-center justify-center text-zinc-500">
                <span className="text-sm mb-2">Image URL expired or missing</span>
                {selectedImage.taskId && (
                  <button
                    onClick={() => {
                      // Refresh the image URL
                      window.location.reload()
                    }}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs"
                  >
                    Refresh Page
                  </button>
                )}
              </div>
            )}
            
            <div className="absolute bottom-6 left-6 flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedImage.url, `source-${selectedImage.id}.jpg`)}
                className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              {sourceImageForComparison && (
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className={`p-3 rounded-full transition-colors flex items-center gap-2 text-sm font-medium ${
                    showComparison
                      ? 'bg-violet-600 text-white hover:bg-violet-500'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <SplitSquareHorizontal className="w-5 h-5" />
                  <span className="hidden md:inline">{showComparison ? 'Exit Compare' : 'Compare'}</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Tool Output (Video or Nano) */}
          <div className={`flex-1 relative flex items-center justify-center bg-zinc-950 ${
            activeTab === 'output' ? 'flex' : 'hidden md:flex'
          }`}>
            {activeTool === 'video' ? (
              // VIDEO TOOL UI
              isGeneratingThisVideo || localIsGenerating ? (
                /* State C: Generating Video */
                <AnimatedSpinner
                  label="Generating Video..."
                  subtitle="You can close this window, generation will continue in background"
                  color="amber"
                />
              ) : !videoUrl ? (
                /* State A: Not Generated Yet */
                <div className="text-center px-4 w-full max-w-md">
                  <div className="mb-6">
                    <VideoSettings
                      values={videoSettings}
                      onChange={(updates) => setVideoSettings(prev => ({ ...prev, ...updates }))}
                      accentColor="amber"
                    />
                  </div>

                  <button
                    onClick={handleGenerateVideo}
                    disabled={!kieApiKey}
                    className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#f59e0b_50%,#E2E8F0_100%)]" />
                    <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-all group-hover:bg-slate-900">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Video
                    </span>
                  </button>
                  <p className="mt-4 text-xs text-zinc-500">
                    {videoSettings.model === 'seedance' ? 'Uses Kling AI Video Model' : 'Uses Grok Imagine Video Model'}
                  </p>
                </div>
              ) : (
                /* State B: Video Result */
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded border border-amber-500/30">
                      Generated Video
                    </span>
                    {/* Show Upscale button if generated with Grok */}
                    {currentVideoModel && currentVideoModel.includes('grok') && (
                      <button
                        onClick={handleUpscaleVideo}
                        className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded border border-violet-500/30 hover:bg-violet-500/30 transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Upscale 2x
                      </button>
                    )}
                  </div>
                  
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-[80vh] max-w-[90%] rounded-lg shadow-[0_0_50px_rgba(245,158,11,0.3)]"
                  />
                  
                  {/* Regenerate Settings Panel */}
                  <AnimatePresence>
                    {showRegenSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-5 space-y-4 shadow-2xl z-20"
                      >
                        <VideoSettings
                          values={videoSettings}
                          onChange={(updates) => setVideoSettings(prev => ({ ...prev, ...updates }))}
                          accentColor="amber"
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { handleGenerateVideo(); setShowRegenSettings(false) }}
                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            Regenerate
                          </button>
                          <button
                            onClick={() => setShowRegenSettings(false)}
                            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Bar */}
                  <div className="absolute bottom-8 flex gap-3">
                    <button 
                      onClick={() => handleDownload(videoUrl, `video-${selectedImage.id}.mp4`)}
                      className="bg-white text-black px-6 py-2 rounded-full font-medium hover:bg-zinc-200 flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Video
                    </button>
                    <button
                      onClick={async () => {
                        const dur = await probeVideoDuration(videoUrl!)
                        useEditorStore.getState().addVideosToEditor([{
                          url: videoUrl!,
                          thumbnailUrl: selectedImage.url,
                          label: selectedImage.prompt || `Scene ${selectedImage.id}`,
                          duration: dur,
                        }])
                        toast({ title: 'Added to Editor', description: 'Video sent to the timeline editor.', variant: 'success' })
                        window.location.href = '/editor'
                      }}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-6 py-2 rounded-full font-medium hover:from-amber-400 hover:to-orange-400 flex items-center shadow-lg shadow-amber-500/20"
                    >
                      <Clapperboard className="w-4 h-4 mr-2" />
                      Send to Editor
                    </button>
                    <button 
                      onClick={() => setShowRegenSettings(!showRegenSettings)}
                      className={`px-6 py-2 rounded-full font-medium flex items-center transition-all ${
                        showRegenSettings
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Regenerate
                    </button>
                    <button className="bg-zinc-800 text-white p-2 rounded-full hover:bg-zinc-700">
                      <Share className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            ) : activeTool === 'nano' ? (
              // NANO EDIT TOOL UI
              localIsGenerating ? (
                <AnimatedSpinner label="Starting Edit..." color="violet" />
              ) : (
                <div className="text-center px-4 w-full max-w-md">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Edit Instructions
                    </label>
                    <textarea
                      value={nanoPrompt}
                      onChange={(e) => setNanoPrompt(e.target.value)}
                      placeholder="Describe how you want to change this image..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 outline-none resize-none h-32"
                    />
                  </div>

                  <button
                    onClick={handleGenerateNano}
                    disabled={!kieApiKey}
                    className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#8b5cf6_50%,#E2E8F0_100%)]" />
                    <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-all group-hover:bg-slate-900">
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Edit
                    </span>
                  </button>
                  <p className="mt-4 text-xs text-zinc-500">Uses Nano Banana Pro. Result will appear in main grid.</p>
                </div>
              )
            ) : (
              // CHARACTER SWAP TOOL UI
              localIsGenerating ? (
                <AnimatedSpinner
                  label="Swapping Characters..."
                  subtitle="Result will appear in the main grid when done."
                  color="orange"
                />
              ) : (
                <div className="px-6 w-full max-w-lg overflow-y-auto max-h-[calc(100vh-80px)] py-6 space-y-6">
                  {/* Swap Model Selector */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Model
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSwapModel('nano')}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                          swapModel === 'nano'
                            ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        Nano Banana Pro
                      </button>
                      <button
                        onClick={() => setSwapModel('gpt')}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                          swapModel === 'gpt'
                            ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        GPT Image 1.5
                      </button>
                    </div>
                  </div>

                  {/* Character Count */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Characters to Replace
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(n => (
                        <button
                          key={n}
                          onClick={() => {
                            setSwapCharacterCount(n)
                            setSwapCharacterRefs(prev => prev.slice(0, n))
                          }}
                          className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all ${
                            swapCharacterCount === n
                              ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Character Reference Slots */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Character References
                    </label>
                    <div className={`grid gap-3 ${swapCharacterCount <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                      {Array.from({ length: swapCharacterCount }).map((_, idx) => {
                        const ref = swapCharacterRefs[idx]
                        return (
                          <div key={idx} className="relative">
                            {ref ? (
                              <div className="aspect-[2/3] rounded-xl border-2 border-orange-500/40 overflow-hidden relative group/slot bg-zinc-900">
                                <img
                                  src={ref.url}
                                  alt={ref.label}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-orange-500/80 text-[10px] font-bold text-white rounded backdrop-blur-sm">
                                  Char {idx + 1}
                                </div>
                                <button
                                  onClick={() => removeCharacterRef(idx)}
                                  className="absolute top-1.5 right-1.5 p-1 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover/slot:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setActiveSlotIndex(idx)}
                                  className="absolute bottom-1.5 inset-x-1.5 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-[10px] font-medium text-white rounded-lg opacity-0 group-hover/slot:opacity-100 transition-opacity text-center"
                                >
                                  Replace
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveSlotIndex(activeSlotIndex === idx ? null : idx)}
                                className={`aspect-[2/3] w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${
                                  activeSlotIndex === idx
                                    ? 'border-orange-500 bg-orange-500/5'
                                    : 'border-zinc-700 hover:border-orange-500/50 bg-zinc-900/50 hover:bg-zinc-900'
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  activeSlotIndex === idx ? 'bg-orange-500/20' : 'bg-zinc-800'
                                }`}>
                                  <Plus className={`w-5 h-5 ${activeSlotIndex === idx ? 'text-orange-400' : 'text-zinc-500'}`} />
                                </div>
                                <span className={`text-xs font-medium ${activeSlotIndex === idx ? 'text-orange-400' : 'text-zinc-500'}`}>
                                  Character {idx + 1}
                                </span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Scene Image Picker (shown when a slot is active) */}
                  <AnimatePresence>
                    {activeSlotIndex !== null && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                              Pick for Character {activeSlotIndex + 1}
                            </span>
                            <button
                              onClick={() => setActiveSlotIndex(null)}
                              className="p-1 text-zinc-500 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* From Scenes */}
                          {allSceneImages.length > 0 && (
                            <div>
                              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">
                                From Scenes
                              </span>
                              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                                {allSceneImages.map(img => (
                                  <button
                                    key={img.id}
                                    onClick={() => addCharacterRef(img.id, img.url, `Scene ${img.sceneId}`)}
                                    className="aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 hover:border-orange-500/50 transition-colors relative group/pick"
                                  >
                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/pick:opacity-100 transition-opacity flex items-center justify-center">
                                      <Plus className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 text-[8px] text-zinc-300 rounded">
                                      S{img.sceneId}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Or Import URL */}
                          <div>
                            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">
                              Or Paste URL
                            </span>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                  type="text"
                                  value={swapImportUrl}
                                  onChange={(e) => setSwapImportUrl(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleImportSwapUrl()}
                                  placeholder="https://..."
                                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-all placeholder:text-zinc-600"
                                />
                              </div>
                              <button
                                onClick={handleImportSwapUrl}
                                disabled={!swapImportUrl.trim()}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold text-xs rounded-lg transition-all"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Per-Character Prompts */}
                  {swapCharacterRefs.length > 0 && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-zinc-400 text-left">
                        Swap Instructions
                      </label>
                      {swapCharacterRefs.map((charRef, idx) => (
                        <div key={charRef.id} className="relative">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded border border-orange-500/30">
                              Char {idx + 1}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate">{charRef.label}</span>
                          </div>
                          <textarea
                            value={charRef.prompt}
                            onChange={(e) => {
                              const newPrompt = e.target.value
                              setSwapCharacterRefs(prev => prev.map((r, i) => i === idx ? { ...r, prompt: newPrompt } : r))
                            }}
                            placeholder="change the character from the first image to the character from the second image, keep the style and pose..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none resize-none h-20"
                          />
                        </div>
                      ))}
                      <p className="text-[10px] text-zinc-600">
                        Each character gets its own Nano Banana Pro API call (base image + reference).
                      </p>
                    </div>
                  )}

                  {/* Generate Button */}
                  <div className="text-center pt-2">
                    <button
                      onClick={handleCharacterSwap}
                      disabled={!kieApiKey || swapCharacterRefs.length === 0}
                      className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#f97316_50%,#E2E8F0_100%)]" />
                      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-all group-hover:bg-slate-900">
                        <Users className="w-4 h-4 mr-2" />
                        Swap {swapCharacterRefs.length} Character{swapCharacterRefs.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                    <p className="mt-3 text-xs text-zinc-500">
                      {swapCharacterRefs.length} separate {swapModel === 'gpt' ? 'GPT Image 1.5' : 'Nano Banana Pro'} call{swapCharacterRefs.length !== 1 ? 's' : ''} (each: base + 1 reference)
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
