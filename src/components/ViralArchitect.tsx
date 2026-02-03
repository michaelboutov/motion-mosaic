'use client'

import { useState } from 'react'
import { useAppStore, Image } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Play, RefreshCw, Wand2, Film, CheckCircle, AlertCircle, Loader2, Eye, Download } from 'lucide-react'
import MotionStudio from '@/components/MotionStudio'

export default function ViralArchitect() {
  const { 
    apiKey, 
    architect, 
    setArchitectState, 
    updateScene, 
    addSceneImages,
    images: allImages,
    addImages,
    setSelectedImageId
  } = useAppStore()

  const [topic, setTopic] = useState('')
  const [isDesigning, setIsDesigning] = useState(false)
  const [expandedSceneId, setExpandedSceneId] = useState<number | null>(null)
  
  // Motion Studio state
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [isStudioOpen, setIsStudioOpen] = useState(false)

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

  const handleDesign = async () => {
    if (!topic || !apiKey || isDesigning) return

    setIsDesigning(true)
    setArchitectState({ isGenerating: true })

    try {
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, apiKey })
      })

      const data = await response.json()

      if (data.error) throw new Error(data.error)

      setArchitectState({
        strategy: data.strategy,
        script: data.script,
        scenes: data.scenes.map((s: any) => ({ 
          ...s, 
          status: 'pending',
          images: []
        })),
        isGenerating: false
      })
    } catch (error) {
      console.error('Architect error:', error)
      setArchitectState({ isGenerating: false })
      // TODO: Show error toast
    } finally {
      setIsDesigning(false)
    }
  }

  const handleGenerateScene = async (sceneId: number, tool: 'Midjourney' | 'Nano Banana', prompt: string, reference?: string) => {
    if (!apiKey) return

    updateScene(sceneId, { status: 'generating' })

    try {
      if (tool === 'Midjourney') {
        // Generate 3 batches (12 images)
        const response = await fetch('/api/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            apiKey,
            batchCount: 3, // 3 batches = 12 images
            aspectRatio: '9:16'
          })
        })

        const result = await response.json()
        
        if (result.success && result.tasks) {
          // Add placeholders to global store and scene
          const newImages: Image[] = []
          
          result.tasks.forEach((task: any) => {
             // Create 4 placeholders per task
             for(let i=0; i<4; i++) {
               newImages.push({
                 id: `scene-${sceneId}-${task.taskId}-${i}`,
                 url: '',
                 status: 'loading',
                 prompt: prompt
               })
             }
          })
          
          // Add to global store so polling works (if we hooked up global polling)
          // Actually, our global polling `useAppStore` hooks need to be aware of these tasks.
          // The current global polling implementation in `page.tsx` polls `activeVideoTasks` and `activeNanoTasks`.
          // It also has logic for `activeImageTasks` but it's coupled to the main grid.
          // We might need to implement local polling here or update the global store to track these specific tasks.
          
          // Let's implement local polling for the Architect view to keep it contained
          pollBatchTasks(sceneId, result.tasks)
        }
      } else if (tool === 'Nano Banana') {
        // Need a reference image from Scene 1
        const scene1 = architect.scenes.find(s => s.id === 1)
        if (!scene1 || scene1.images.length === 0) {
          alert('Please generate and select a reference image in Scene 1 first!')
          updateScene(sceneId, { status: 'pending' })
          return
        }

        // Use the first image of Scene 1 as reference (or selected one if we had selection logic)
        // For now, let's assume the user "Selected" one by clicking it, but we haven't built selection yet.
        // Let's just take the first completed image from Scene 1.
        const refImage = scene1.images.find(img => img.status === 'done')
        
        if (!refImage) {
           alert('Scene 1 has no completed images to use as reference.')
           updateScene(sceneId, { status: 'pending' })
           return
        }

        const response = await fetch('/api/generate-nano', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: refImage.url,
            prompt,
            apiKey,
            aspectRatio: '9:16'
          })
        })
        
        const result = await response.json()
        if (result.success) {
           pollNanoTask(sceneId, result.taskId, refImage.id)
        }
      }
    } catch (error) {
      console.error(`Error generating scene ${sceneId}:`, error)
      updateScene(sceneId, { status: 'error' })
    }
  }

  const pollBatchTasks = async (sceneId: number, tasks: any[]) => {
    const completedTaskIds = new Set<string>()
    
    // Add placeholders immediately
    const placeholders: Image[] = tasks.flatMap(t => 
      Array(4).fill(0).map((_, i) => ({
        id: `temp-${t.taskId}-${i}`,
        url: '',
        status: 'loading',
        prompt: ''
      }))
    )
    addSceneImages(sceneId, placeholders)

    const check = async () => {
       let allDone = true
       let hasNewData = false
       const newCompletedTasks: any[] = []

       for(const task of tasks) {
         if(completedTaskIds.has(task.taskId)) continue
         
         try {
           const res = await fetch(`/api/generate-batch/callback?taskId=${task.taskId}`, {
             headers: { 'Authorization': `Bearer ${apiKey}` }
           })
           const data = await res.json()
           
           if(data.status === 'success' && data.resultUrls) {
             completedTaskIds.add(task.taskId)
             newCompletedTasks.push({ task, urls: data.resultUrls })
             hasNewData = true
           } else if (data.status === 'fail') {
             completedTaskIds.add(task.taskId)
             // We could mark placeholders as error or remove them
           } else {
             allDone = false
           }
         } catch(e) {
           allDone = false
         }
       }
       
       if (hasNewData) {
         // Get current scene state to merge
         const currentScene = useAppStore.getState().architect.scenes.find(s => s.id === sceneId)
         if (currentScene) {
            let updatedImages = [...currentScene.images]
            
            // For each completed task, remove its placeholders and add real images
            newCompletedTasks.forEach(({ task, urls }) => {
              // Remove placeholders for this task
              updatedImages = updatedImages.filter(img => !img.id.startsWith(`temp-${task.taskId}`))
              
              // Add real images
              const realImages: Image[] = urls.map((url: string, idx: number) => ({
                 id: `mj-${task.taskId}-${idx}`,
                 url,
                 status: 'done',
                 prompt: 'Scene generation'
               }))
               updatedImages.push(...realImages)
            })
            
            updateScene(sceneId, { images: updatedImages })
         }
       }

       if(!allDone) {
         setTimeout(check, 3000)
       } else {
         updateScene(sceneId, { status: 'done' })
       }
    }
    
    check()
  }

  const pollNanoTask = async (sceneId: number, taskId: string, sourceId: string) => {
    // Add placeholder
    addSceneImages(sceneId, [{
      id: `nano-pending-${taskId}`,
      url: '',
      status: 'loading',
      prompt: 'Nano Banana Edit'
    }])

    const check = async () => {
      try {
        const res = await fetch(`/api/nano-callback?taskId=${taskId}`, {
           headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        const data = await res.json()
        
        if (data.status === 'success' && data.imageUrls) {
           const newImages = data.imageUrls.map((url: string, i: number) => ({
             id: `nano-${taskId}-${i}`,
             url,
             status: 'done',
             prompt: 'Nano Edit'
           }))
           
           // Replace placeholder
           const currentScene = useAppStore.getState().architect.scenes.find(s => s.id === sceneId)
           if (currentScene) {
             const updatedImages = currentScene.images.filter(img => img.id !== `nano-pending-${taskId}`)
             updatedImages.push(...newImages)
             updateScene(sceneId, { images: updatedImages, status: 'done' })
           }
        } else if (data.status === 'fail') {
           updateScene(sceneId, { status: 'error' })
        } else {
           setTimeout(check, 3000)
        }
      } catch (e) {
        setTimeout(check, 3000)
      }
    }
    check()
  }

  return (
    <div className="w-full mx-auto p-6 space-y-8 pb-32">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
          Viral AI Architect
        </h1>
        <p className="text-zinc-400">
          Cinematic Storytelling Pipeline • Midjourney v7 • Nano Banana • Grok Motion
        </p>
      </div>

      {/* Input Section - Glass Style */}
      <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-6 overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10 flex gap-4">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a video concept (e.g., 'The Reality Glitch', 'Cyberpunk Detective')..."
            className="flex-1 bg-zinc-950/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all backdrop-blur-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleDesign()}
          />
          <button
            onClick={handleDesign}
            disabled={!topic || isDesigning}
            className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]"
          >
            {isDesigning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            Design
          </button>
        </div>
      </div>

      {/* Results Section */}
      {architect.strategy && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-500">
          
          {/* Strategy & Script Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strategy Card - Glass Style */}
            <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-amber-200 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Strategy
              </h3>
              <div className="space-y-3 text-sm text-zinc-300">
                <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-zinc-800/50">
                  <span className="text-zinc-500 block text-xs mb-1 uppercase tracking-wider">Concept</span>
                  {architect.strategy.concept}
                </div>
                <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-zinc-800/50">
                  <span className="text-zinc-500 block text-xs mb-1 uppercase tracking-wider">Music Vibe</span>
                  {architect.strategy.music}
                </div>
                <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-zinc-800/50">
                  <span className="text-zinc-500 block text-xs mb-1 uppercase tracking-wider">Loop Logic</span>
                  <div className="text-amber-400 font-mono text-xs mt-1">
                    {architect.strategy.loopLogic}
                  </div>
                </div>
              </div>
            </div>

            {/* Script Card - Glass Style */}
            <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-purple-200 flex items-center gap-2">
                <Film className="w-5 h-5" /> Audio Script
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-purple-500/20">
                  <span className="text-purple-400 block text-xs mb-1 uppercase tracking-wider">Scene 1 (Hook)</span>
                  <p className="italic text-zinc-300">"{architect.script?.scene1}"</p>
                </div>
                <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-zinc-800/50">
                  <span className="text-zinc-500 block text-xs mb-1 uppercase tracking-wider">Narration</span>
                  <p className="text-zinc-300 leading-relaxed">{architect.script?.narration}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Production Board - Glass Style */}
          <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white">Production Board</h3>
              <div className="flex gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Midjourney (12 imgs)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Nano Banana (1 img)</span>
              </div>
            </div>
            
            <div className="divide-y divide-zinc-800">
              {architect.scenes.map((scene) => (
                <div key={scene.id} className="group hover:bg-zinc-800/20 transition-colors border-b border-zinc-800/30 last:border-b-0">
                  <div className="p-4 flex items-start gap-4">
                    {/* Scene ID - Glass Style */}
                    <div className="flex-shrink-0 w-12 h-12 bg-zinc-950/50 backdrop-blur-sm rounded-lg flex items-center justify-center font-mono text-lg font-bold text-zinc-600 group-hover:text-white transition-colors border border-zinc-800/50">
                      {scene.id}
                    </div>

                    {/* Scene Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          scene.tool === 'Midjourney' 
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {scene.tool}
                        </span>
                        <h4 className="font-medium text-white truncate">{scene.visual}</h4>
                      </div>
                      <textarea
                        value={scene.prompt}
                        onChange={(e) => updateScene(scene.id, { prompt: e.target.value })}
                        disabled={scene.status === 'generating'}
                        className="w-full text-xs text-zinc-400 font-mono bg-zinc-950/30 backdrop-blur-sm p-2 rounded border border-zinc-800/30 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 resize-y min-h-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter scene prompt..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateScene(scene.id, scene.tool, scene.prompt)}
                        disabled={scene.status === 'generating'}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                          scene.status === 'generating'
                            ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                            : scene.status === 'done'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                      >
                        {scene.status === 'generating' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : scene.status === 'done' ? (
                          <RefreshCw className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {scene.status === 'generating' ? 'Generating...' : scene.status === 'done' ? 'Regenerate' : 'Generate'}
                      </button>
                      
                      <button 
                        onClick={() => setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)}
                        className={`p-2 rounded-lg transition-colors backdrop-blur-sm ${
                          expandedSceneId === scene.id ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/30'
                        }`}
                      >
                         Images ({scene.images.filter(i => i.status !== 'loading').length})
                      </button>
                    </div>
                  </div>

                  {/* Expanded Image Grid - Mosaic Flow Style */}
                  <AnimatePresence>
                    {(expandedSceneId === scene.id || scene.status === 'generating' || scene.images.length > 0) && (
                       <motion.div 
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden bg-zinc-950/20 backdrop-blur-sm border-t border-zinc-800/30"
                       >
                         <div className="p-4">
                           {scene.images.length === 0 ? (
                             <div className="text-center py-8 text-zinc-500 text-sm italic">
                               No images generated yet. Click "Generate" to start.
                             </div>
                           ) : (
                             <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                               {scene.images.filter(img => img.status !== 'loading').map((img) => (
                                 <motion.div 
                                   key={img.id}
                                   layoutId={`architect-image-${img.id}`}
                                   className="group/img relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 cursor-pointer border border-zinc-800/50 hover:border-amber-500/50 transition-colors"
                                   onClick={() => handleImageClick(img)}
                                 >
                                   <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                                   
                                   {/* Hover Overlay - Glass Style */}
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                     <div className="flex items-center gap-2">
                                       <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20">
                                         <Eye className="w-3 h-3 inline mr-1" />
                                         View
                                       </span>
                                     </div>
                                   </div>
                                   
                                   {/* Download Button */}
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       const link = document.createElement('a')
                                       link.href = img.url
                                       link.download = `architect-${img.id}.jpg`
                                       link.click()
                                     }}
                                     className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                                   >
                                     <Download className="w-3 h-3 text-white" />
                                   </button>
                                 </motion.div>
                               ))}
                               {/* Loading Placeholders - Mosaic Style */}
                               {scene.images.filter(img => img.status === 'loading').map((img, idx) => (
                                  <div key={`${img.id}-${idx}`} className="aspect-[2/3] bg-zinc-800/50 rounded-lg animate-pulse flex items-center justify-center border border-zinc-800/30">
                                    <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                                  </div>
                               ))}
                             </div>
                           )}
                         </div>
                       </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
    </div>
  )
}
