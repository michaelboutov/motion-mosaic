'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, Image } from '@/lib/store'
import { X, Download, Share, Sparkles, Wand2 } from 'lucide-react'
import { downloadFile } from '@/lib/utils'
import { useToast } from '@/components/Toast'

interface MotionStudioProps {
  isOpen: boolean
  onClose: () => void
  selectedImage: Image | null
}

export default function MotionStudio({ isOpen, onClose, selectedImage }: MotionStudioProps) {
  const { 
    generatedVideos, 
    activeVideoTasks,
    addVideoTask,
    setGeneratedVideo,
    kieApiKey,
    addNanoTask
  } = useAppStore()
  
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'source' | 'output'>('source')
  const [activeTool, setActiveTool] = useState<'video' | 'nano'>('video')
  const [localIsGenerating, setLocalIsGenerating] = useState(false)
  const [nanoPrompt, setNanoPrompt] = useState('')

  // Video Generation State
  const [selectedModel, setSelectedModel] = useState<'seedance' | 'grok'>('seedance')
  const [grokDuration, setGrokDuration] = useState<'6' | '10'>('6')
  const [grokMode, setGrokMode] = useState<'normal' | 'fun'>('normal')

  const videoData = selectedImage ? generatedVideos[selectedImage.id] : null
  const videoUrl = videoData?.url
  
  // We track "last generated model" in local state for immediate feedback, 
  // but we prefer the stored model if available.
  const [lastGeneratedModel, setLastGeneratedModel] = useState<'seedance' | 'grok' | null>(null)
  const currentVideoModel = videoData?.model || lastGeneratedModel

  const isGeneratingThisVideo = selectedImage ? activeVideoTasks.some(t => t.imageId === selectedImage.id) : false

  const [videoPrompt, setVideoPrompt] = useState('')

  // Initialize prompts when selectedImage changes
  useEffect(() => {
    if (selectedImage?.prompt) {
      setVideoPrompt(selectedImage.prompt)
      setNanoPrompt(selectedImage.prompt)
    }
  }, [selectedImage?.id])

  const handleGenerateVideo = async () => {
    if (!selectedImage || !kieApiKey) return

    setLocalIsGenerating(true)
    setActiveTab('output')
    setActiveTool('video')
    setLastGeneratedModel(selectedModel)

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieApiKey}`
        },
        body: JSON.stringify({
          imageUrl: selectedImage.url,
          prompt: videoPrompt || selectedImage.prompt || 'Animate this image',
          model: selectedModel === 'grok' ? 'grok-imagine/image-to-video' : 'bytedance/seedance-1.5-pro',
          // Grok specific params
          ...(selectedModel === 'grok' && {
            duration: grokDuration,
            mode: grokMode
          })
        })
      })

      const result = await response.json()

      if (result.success && result.taskId) {
        addVideoTask(result.taskId, selectedImage.id, selectedModel)
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
              {activeTool === 'video' ? 'Generated Video' : 'Nano Edit'}
            </button>
          </div>

          {/* LEFT: Source Image */}
          <div className={`flex-1 relative border-r border-zinc-800 flex items-center justify-center bg-zinc-900/50 ${
            activeTab === 'source' ? 'flex' : 'hidden md:flex'
          }`}>
            <div className="absolute top-4 left-4 z-10">
              <span className="px-2 py-1 bg-black/50 backdrop-blur text-xs text-zinc-300 rounded border border-zinc-700">
                Source
              </span>
            </div>
            
            {selectedImage.url ? (
              <motion.img
                layoutId={`image-${selectedImage.id}`}
                src={selectedImage.url}
                className="max-h-[80vh] max-w-[90%] object-contain shadow-2xl rounded-lg"
                alt={selectedImage.prompt || 'Source image'}
              />
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
            
            <button
              onClick={() => handleDownload(selectedImage.url, `source-${selectedImage.id}.jpg`)}
              className="absolute bottom-6 left-6 p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* RIGHT: Tool Output (Video or Nano) */}
          <div className={`flex-1 relative flex items-center justify-center bg-zinc-950 ${
            activeTab === 'output' ? 'flex' : 'hidden md:flex'
          }`}>
            {activeTool === 'video' ? (
              // VIDEO TOOL UI
              isGeneratingThisVideo || localIsGenerating ? (
                /* State C: Generating Video */
                <div className="text-center px-4">
                  <div className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px]">
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#f59e0b_50%,#E2E8F0_100%)]" />
                    <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating Video...
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">You can close this window, generation will continue in background</p>
                </div>
              ) : !videoUrl ? (
                /* State A: Not Generated Yet */
                <div className="text-center px-4 w-full max-w-md">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Model
                    </label>
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setSelectedModel('seedance')}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          selectedModel === 'seedance'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        Seedance (Standard)
                      </button>
                      <button
                        onClick={() => setSelectedModel('grok')}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          selectedModel === 'grok'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        Grok (High Quality)
                      </button>
                    </div>

                    {selectedModel === 'grok' && (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5 text-left">
                            Duration
                          </label>
                          <div className="flex gap-1">
                            {['6', '10'].map((d) => (
                              <button
                                key={d}
                                onClick={() => setGrokDuration(d as '6' | '10')}
                                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors border ${
                                  grokDuration === d
                                    ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                }`}
                              >
                                {d}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5 text-left">
                            Mode
                          </label>
                          <div className="flex gap-1">
                            {['normal', 'fun'].map((m) => (
                              <button
                                key={m}
                                onClick={() => setGrokMode(m as 'normal' | 'fun')}
                                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors border ${
                                  grokMode === m
                                    ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                }`}
                              >
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-left">
                      Video Prompt
                    </label>
                    <textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Describe how you want to animate the image..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none resize-none h-24"
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
                    {selectedModel === 'seedance' ? 'Uses Kling AI Video Model' : 'Uses Grok Imagine Video Model'}
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
                      onClick={handleGenerateVideo}
                      className="bg-zinc-800 text-white px-6 py-2 rounded-full font-medium hover:bg-zinc-700 flex items-center"
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
            ) : (
              // NANO EDIT TOOL UI
              localIsGenerating ? (
                 <div className="text-center px-4">
                  <div className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px]">
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#8b5cf6_50%,#E2E8F0_100%)]" />
                    <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Starting Edit...
                    </span>
                  </div>
                </div>
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
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
