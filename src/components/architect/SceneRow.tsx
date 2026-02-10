'use client'

import { useState } from 'react'
import { useAppStore, Image } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, RefreshCw, Loader2, Sparkles, Eye, Download, CheckCircle, Link2, Plus, X, GripVertical, Wand2 } from 'lucide-react'
import { downloadFile } from '@/lib/utils'
import VideoSettings, { VideoSettingsValues } from '@/components/VideoSettings'

const MJ_PROMPT_LIMIT = 4000

interface SceneRowProps {
  scene: {
    id: number
    visual: string
    tool: 'Midjourney' | 'Nano Banana'
    reference: string
    prompt: string
    grokMotion: string
    status: 'pending' | 'generating' | 'done' | 'error'
    images: Image[]
    selectedImageId?: string
    video?: {
      url: string
      status: 'pending' | 'generating' | 'done' | 'error'
      taskId?: string
    }
    activeTasks?: string[]
  }
  isExpanded: boolean
  isImporting: boolean
  importUrl: string
  dragHandleProps?: Record<string, any>
  onToggleExpand: () => void
  onToggleImport: () => void
  onImportUrlChange: (url: string) => void
  onImportImage: (sceneId: number) => void
  onCancelImport: () => void
  onGenerateScene: (sceneId: number, tool: 'Midjourney' | 'Nano Banana', prompt: string) => void
  onAnimateScene: (sceneId: number, options?: { model?: 'seedream' | 'grok'; prompt?: string; duration?: string; mode?: string }) => void
  onImageClick: (image: Image) => void
  onImageError: (sceneId: number, imageId: string, taskId: string | undefined) => void
}

export default function SceneRow({
  scene,
  isExpanded,
  isImporting,
  importUrl,
  dragHandleProps,
  onToggleExpand,
  onToggleImport,
  onImportUrlChange,
  onImportImage,
  onCancelImport,
  onGenerateScene,
  onAnimateScene,
  onImageClick,
  onImageError,
}: SceneRowProps) {
  const { updateScene, kieApiKey, googleApiKey, provider, kieModel } = useAppStore()
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleEnhancePrompt = async () => {
    if (isEnhancing || !scene.prompt.trim()) return
    const apiKey = provider === 'google' ? googleApiKey : kieApiKey
    if (!apiKey) return
    setIsEnhancing(true)
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scene.prompt, apiKey, provider, kieModel }),
      })
      const data = await res.json()
      if (data.enhanced) {
        updateScene(scene.id, { prompt: data.enhanced })
      }
    } catch (e) {
      console.error('Failed to enhance prompt:', e)
    } finally {
      setIsEnhancing(false)
    }
  }

  // Video generation settings
  const [showVideoSettings, setShowVideoSettings] = useState(false)
  const [videoSettings, setVideoSettings] = useState<VideoSettingsValues>({
    model: 'seedance',
    prompt: scene.grokMotion || '',
    grokDuration: '6',
    grokMode: 'normal',
  })

  const handleStartAnimate = () => {
    onAnimateScene(scene.id, {
      model: videoSettings.model === 'seedance' ? 'seedream' : 'grok',
      prompt: videoSettings.prompt,
      ...(videoSettings.model === 'grok' && { duration: videoSettings.grokDuration, mode: videoSettings.grokMode }),
    })
    setShowVideoSettings(false)
  }

  return (
    <div className="group hover:bg-zinc-800/20 transition-colors border-b border-zinc-800/30 last:border-b-0">
      <div className="p-4 flex items-start gap-4">
        {/* Drag Handle + Scene ID */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 text-zinc-700 hover:text-zinc-400 transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="w-12 h-12 bg-zinc-950/50 backdrop-blur-sm rounded-lg flex items-center justify-center font-mono text-lg font-bold text-zinc-600 group-hover:text-white transition-colors border border-zinc-800/50">
            {scene.id}
          </div>
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
          <div className="flex items-center gap-2 mb-2">
            {scene.id === 1 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-[10px] text-purple-400 border border-purple-500/30">
                <Sparkles className="w-2 h-2" /> Lip-Sync Required
              </span>
            )}
            {scene.video?.status === 'done' && (
              <span className="text-[10px] text-zinc-500 font-mono italic">
                Video Ready
              </span>
            )}
          </div>
          <textarea
            value={scene.prompt}
            onChange={(e) => updateScene(scene.id, { prompt: e.target.value })}
            disabled={scene.status === 'generating'}
            className={`w-full text-xs text-zinc-400 font-mono bg-zinc-950/30 backdrop-blur-sm p-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-500/20 resize-y min-h-[60px] disabled:opacity-50 disabled:cursor-not-allowed ${
              scene.prompt.length > MJ_PROMPT_LIMIT
                ? 'border-red-500/50 focus:border-red-500/50'
                : 'border-zinc-800/30 focus:border-amber-500/50'
            }`}
            placeholder="Enter scene prompt..."
          />
          <div className="flex justify-between items-center mt-1">
            <button
              onClick={handleEnhancePrompt}
              disabled={isEnhancing || !scene.prompt.trim() || scene.status === 'generating'}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Enhance prompt with AI"
            >
              {isEnhancing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              {isEnhancing ? 'Enhancing...' : '✨ Enhance'}
            </button>
            <span className={`text-[10px] font-mono ${
              scene.prompt.length > MJ_PROMPT_LIMIT ? 'text-red-400' :
              scene.prompt.length > MJ_PROMPT_LIMIT * 0.875 ? 'text-amber-400' : 'text-zinc-600'
            }`}>
              {scene.prompt.length.toLocaleString()} / {MJ_PROMPT_LIMIT.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => onGenerateScene(scene.id, scene.tool, scene.prompt)}
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

          {/* Animate Button (Image to Video) */}
          {scene.status === 'done' && (
            <button
              onClick={() => {
                if (scene.video?.status === 'generating') return
                setShowVideoSettings(!showVideoSettings)
              }}
              disabled={scene.video?.status === 'generating'}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                scene.video?.status === 'generating'
                  ? 'bg-purple-900/50 text-purple-300 cursor-wait'
                  : showVideoSettings
                  ? 'bg-purple-600 text-white ring-2 ring-purple-400/50'
                  : scene.video?.status === 'done'
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
                  : 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
              }`}
            >
              {scene.video?.status === 'generating' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {scene.video?.status === 'generating' ? 'Animating...' : scene.video?.status === 'done' ? 'Re-animate' : 'Animate'}
            </button>
          )}
          
          <button 
            onClick={onToggleExpand}
            className={`p-2 rounded-lg transition-colors backdrop-blur-sm ${
              isExpanded ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/30'
            }`}
          >
             Images ({scene.images.filter(i => i.status !== 'loading').length})
          </button>

          {/* Add Image by URL Button */}
          <button
            onClick={onToggleImport}
            className={`p-2 rounded-lg transition-colors backdrop-blur-sm ${
              isImporting ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/30'
            }`}
            title="Add Image by URL"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Settings Panel */}
      <AnimatePresence>
        {showVideoSettings && scene.status === 'done' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-purple-500/20 bg-purple-950/10"
          >
            <div className="p-4 space-y-4 max-w-2xl">
              <VideoSettings
                values={videoSettings}
                onChange={(updates) => setVideoSettings(prev => ({ ...prev, ...updates }))}
                accentColor="purple"
                compact
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartAnimate}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                >
                  <Sparkles className="w-3 h-3" />
                  {scene.video?.status === 'done' ? 'Re-animate' : 'Start Animation'}
                </button>
                <button
                  onClick={() => setShowVideoSettings(false)}
                  className="px-4 py-2 text-zinc-500 hover:text-white text-xs rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] text-zinc-600">
                  {videoSettings.model === 'seedance' ? 'Seedance 1.5 Pro' : 'Grok Imagine Video'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* URL Import Input */}
      <AnimatePresence>
        {isImporting && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-800/30 bg-zinc-900/30"
          >
            <div className="p-4 flex gap-3 items-center">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={importUrl}
                  onChange={(e) => onImportUrlChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onImportImage(scene.id)}
                  placeholder="Paste image URL (e.g., https://...)"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all placeholder:text-zinc-600"
                  autoFocus
                />
              </div>
              <button
                onClick={() => onImportImage(scene.id)}
                disabled={!importUrl.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
              <button
                onClick={onCancelImport}
                className="p-2 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Image Grid */}
      <AnimatePresence>
        {(isExpanded || scene.status === 'generating' || scene.images.length > 0 || scene.video?.url) && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden bg-zinc-950/20 backdrop-blur-sm border-t border-zinc-800/30"
           >
             <div className="p-4 space-y-4">
               {/* Video Preview Section */}
               {scene.video?.url && (
                 <div className="relative aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)] bg-zinc-900">
                   <video 
                     src={scene.video.url} 
                     controls 
                     autoPlay 
                     loop 
                     className="w-full h-full object-cover"
                   />
                   <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600/80 backdrop-blur-md text-[10px] font-bold text-white rounded uppercase tracking-wider">
                     Scene Video
                   </div>
                   <button
                     onClick={() => downloadFile(scene.video!.url, `scene-${scene.id}-video.mp4`)}
                     className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-purple-600 transition-colors"
                   >
                     <Download className="w-4 h-4" />
                   </button>
                 </div>
               )}

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
                       className={`group/img relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 cursor-pointer border-2 transition-all ${
                         scene.selectedImageId === img.id 
                           ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                           : 'border-zinc-800/50 hover:border-amber-500/50'
                       } ${!img.url || img.url === '' ? 'opacity-50' : ''}`}
                       onClick={() => {
                         updateScene(scene.id, { selectedImageId: img.id })
                         onImageClick({ ...img, videoPrompt: scene.grokMotion })
                       }}
                     >
                       {img.url && img.url !== '' ? (
                         <img 
                          src={img.url} 
                          alt={img.prompt} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" 
                          onError={() => onImageError(scene.id, img.id, img.taskId)}
                        />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                           <span className="text-xs text-center px-2">No image</span>
                           {img.taskId && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 onImageError(scene.id, img.id, img.taskId)
                               }}
                               className="mt-2 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-zinc-400"
                             >
                               Refresh
                             </button>
                           )}
                         </div>
                       )}
                       
                       {/* Selection Badge */}
                       {scene.selectedImageId === img.id && (
                         <div className="absolute top-2 left-2 z-10">
                           <div className="bg-amber-500 text-black p-1 rounded-full shadow-lg">
                             <CheckCircle className="w-4 h-4" />
                           </div>
                         </div>
                       )}

                       {/* Hover Overlay */}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none flex items-center justify-center backdrop-blur-[2px]">
                         <div className="flex items-center gap-2">
                           <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20">
                             <Eye className="w-3 h-3 inline mr-1" />
                             {scene.selectedImageId === img.id ? 'Selected' : 'Select'}
                           </span>
                         </div>
                       </div>
                       
                       {/* Download Button */}
                       <button
                         onClick={(e) => {
                           e.stopPropagation()
                           downloadFile(img.url, `architect-${img.id}.jpg`)
                         }}
                         className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                       >
                         <Download className="w-3 h-3 text-white" />
                       </button>
                     </motion.div>
                   ))}
                   {/* Loading Placeholders */}
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
  )
}
