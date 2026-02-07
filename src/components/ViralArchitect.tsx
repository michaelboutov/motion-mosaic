'use client'

import { useState, useEffect } from 'react'
import { useAppStore, Image, SavedProject } from '@/lib/store'
import { AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, Loader2, Clapperboard, Save, FolderOpen, Settings, Play, Download, LayoutList, Film } from 'lucide-react'
import { useStudioHandlers } from '@/lib/useStudioHandlers'
import { useArchitectActions } from '@/lib/useArchitectActions'
import MotionStudio from '@/components/MotionStudio'
import ParticleBubble from '@/components/ParticleBubble'
import { useToast } from '@/components/Toast'
import ProjectLibrary from '@/components/ProjectLibrary'
import ApiKeyInput from '@/components/ApiKeyInput'
import StrategyCard from '@/components/architect/StrategyCard'
import ScriptCard from '@/components/architect/ScriptCard'
import SceneRow from '@/components/architect/SceneRow'
import DesignProgress from '@/components/architect/DesignProgress'
import TimelineView from '@/components/architect/TimelineView'
import ConfirmDialog from '@/components/ConfirmDialog'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { downloadFile } from '@/lib/utils'

const PROMPT_TEMPLATES = [
  { label: 'Horror', icon: '🎃', topic: 'A cursed VHS tape that rewrites reality each time it\'s played' },
  { label: 'Sci-Fi', icon: '🚀', topic: 'A rogue AI on a dying space station discovers it can dream' },
  { label: 'Documentary', icon: '🎬', topic: 'The untold story of a forgotten Cold War numbers station' },
  { label: 'Thriller', icon: '🕵️', topic: 'A detective uncovers a conspiracy hidden in city surveillance feeds' },
  { label: 'Fantasy', icon: '🌌', topic: 'An ancient library where every book is a portal to another world' },
  { label: 'Drama', icon: '💔', topic: 'Two strangers connected by recurring dreams they can\'t explain' },
  { label: 'Comedy', icon: '😂', topic: 'An office worker accidentally becomes an internet cryptid' },
  { label: 'Cyberpunk', icon: '🔮', topic: 'A black-market memory dealer in a neon-drenched megacity' },
]

// ── Sortable wrapper for each scene row (dnd-kit) ────────────────────
function SortableSceneRow({ id, children }: { id: number; children: (handleProps: Record<string, any>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto' as any,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

export default function ViralArchitect() {
  const { 
    kieApiKey,
    googleApiKey,
    provider,
    architect, 
    addSceneImages,
    reorderScenes,
    topic,
    setTopic,
    scriptLength,
    setScriptLength
  } = useAppStore()

  // Shared studio open/close logic
  const { selectedImage, isStudioOpen, handleImageClick, handleCloseStudio } = useStudioHandlers()

  // All architect business logic (design, generate, animate, voiceover, refresh, save/load)
  const {
    isDesigning,
    isRefreshing,
    refreshResult,
    handleDesign,
    handleGenerateScene,
    handleAnimateScene,
    handleGenerateVoiceover,
    handleGenerateAllScenes,
    handleImageError,
    handleSave,
    handleNewProject,
    refreshAllImageUrls,
    loadProject,
  } = useArchitectActions()

  const { toast } = useToast()

  // Local UI state
  const [expandedSceneId, setExpandedSceneId] = useState<number | null>(null)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [importingSceneId, setImportingSceneId] = useState<number | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = architect.scenes.findIndex((s) => s.id === active.id)
    const newIndex = architect.scenes.findIndex((s) => s.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderScenes(oldIndex, newIndex)
  }

  const handleDownloadAll = () => {
    const items: { url: string; name: string }[] = []
    for (const scene of architect.scenes) {
      for (const img of scene.images) {
        if (img.status === 'done' && img.url) {
          items.push({ url: img.url, name: `scene-${scene.id}-${img.id}.jpg` })
        }
      }
      if (scene.video?.url && scene.video.status === 'done') {
        items.push({ url: scene.video.url, name: `scene-${scene.id}-video.mp4` })
      }
    }
    if (items.length === 0) {
      toast({ title: 'Nothing to download', description: 'No completed images or videos found.', variant: 'warning' })
      return
    }
    toast({ title: `Downloading ${items.length} file(s)…`, variant: 'default' })
    items.forEach((item, i) => {
      setTimeout(() => downloadFile(item.url, item.name), i * 300)
    })
  }

  const handleConfirmNewProject = () => {
    handleNewProject()
    setShowNewProjectConfirm(false)
  }

  useEffect(() => {
    if (topic && !architect.strategy) {
      setDraftRecovered(true)
      toast({ title: 'Draft recovered', description: `Your previous topic "${topic}" has been restored.`, variant: 'default' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = (project: SavedProject) => {
    loadProject(project.id)
    setIsLibraryOpen(false)
  }

  const handleImportImageUrl = (sceneId: number) => {
    if (!importUrl.trim()) return
    try {
      new URL(importUrl)
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL.', variant: 'warning' })
      return
    }
    const newImage: Image = {
      id: `import-${Date.now()}`,
      url: importUrl.trim(),
      status: 'done',
      prompt: 'Imported via URL',
    }
    addSceneImages(sceneId, [newImage])
    setImportUrl('')
    setImportingSceneId(null)
    setExpandedSceneId(sceneId)
  }

  return (
    <div className="w-full min-h-screen relative">
      {/* Design Progress Overlay (#8) */}
      {isDesigning && !architect.strategy && <DesignProgress />}

      {/* Empty State */}
      {!architect.strategy && (
        <>
          <div className="absolute top-6 right-6 z-50">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-zinc-900/50 backdrop-blur-md border border-zinc-800/50 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-xl"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <ParticleBubble />
            <div className="relative z-20 text-center p-8 bg-zinc-950/20 backdrop-blur-sm rounded-3xl border border-zinc-800/50">
              <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">Flow</h1>
              <p className="text-zinc-300 text-xl font-light mb-8">Cinematic Storytelling Pipeline</p>
              
              <button
                onClick={() => setIsLibraryOpen(true)}
                className="px-6 py-2 bg-zinc-800/50 hover:bg-zinc-800 text-white rounded-full border border-zinc-700/50 transition-all hover:scale-105 flex items-center gap-2 mx-auto"
              >
                <FolderOpen className="w-4 h-4" />
                Open Library
              </button>

              {/* Prompt Templates */}
              <div className="mt-8">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Quick Start Templates</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                  {PROMPT_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setTopic(t.topic)}
                      className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-amber-500/30 rounded-full text-sm text-zinc-300 hover:text-white transition-all"
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content when strategy exists */}
      {architect.strategy && (
        <div className="w-full mx-auto p-6 space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-10 duration-500">
          
          {/* Header Actions */}
          <div className="flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                 <Sparkles className="w-5 h-5 text-amber-500" />
               </div>
               <div>
                 <h2 className="text-white font-bold">{architect.strategy.concept}</h2>
                 <p className="text-xs text-zinc-400">Architect Flow</p>
               </div>
             </div>
             
             <div className="flex gap-2">
               <button
                 onClick={() => setShowNewProjectConfirm(true)}
                 className="p-2 text-zinc-400 hover:text-white transition-colors"
                 title="New Project"
               >
                 <RefreshCw className="w-5 h-5" />
               </button>
               <button
                 onClick={() => setIsSettingsOpen(true)}
                 className="p-2 text-zinc-400 hover:text-white transition-colors"
                 title="Settings"
               >
                 <Settings className="w-5 h-5" />
               </button>
               <button
                 onClick={() => setIsLibraryOpen(true)}
                 className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-2"
               >
                 <FolderOpen className="w-4 h-4" />
                 Library
               </button>
               <button
                 onClick={handleSave}
                 className="px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors flex items-center gap-2"
               >
                 <Save className="w-4 h-4" />
                 Save Flow
               </button>
             </div>
          </div>

          {/* Strategy & Script Grid — now using extracted components */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StrategyCard />
            <ScriptCard onGenerateVoiceover={handleGenerateVoiceover} />
          </div>

          {/* Production Board */}
          <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-white">Production Board</h3>
                <button
                  onClick={handleGenerateAllScenes}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all flex items-center gap-2"
                >
                  <Play className="w-2.5 h-2.5" />
                  Generate All
                </button>
                <button
                  onClick={refreshAllImageUrls}
                  disabled={isRefreshing}
                  className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Images'}
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Download className="w-2.5 h-2.5" />
                  Download All
                </button>
                {refreshResult && (
                  <span className="text-[10px] text-zinc-400 animate-in fade-in">{refreshResult}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/30">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                    title="List View"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                    title="Timeline View"
                  >
                    <Film className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Midjourney (12 imgs)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Nano Banana (1 img)</span>
                </div>
              </div>
            </div>

            {/* Timeline / Storyboard View (#12) */}
            {viewMode === 'timeline' && (
              <TimelineView
                scenes={architect.scenes}
                onSceneClick={(id) => setExpandedSceneId(expandedSceneId === id ? null : id)}
                activeSceneId={expandedSceneId}
              />
            )}
            
            {/* Scene Rows with Drag-and-Drop (#13) */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={architect.scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-zinc-800">
                  {architect.scenes.map((scene) => (
                    <SortableSceneRow key={scene.id} id={scene.id}>
                      {(handleProps) => (
                        <SceneRow
                          scene={scene}
                          isExpanded={expandedSceneId === scene.id}
                          isImporting={importingSceneId === scene.id}
                          importUrl={importUrl}
                          dragHandleProps={handleProps}
                          onToggleExpand={() => setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)}
                          onToggleImport={() => setImportingSceneId(importingSceneId === scene.id ? null : scene.id)}
                          onImportUrlChange={setImportUrl}
                          onImportImage={handleImportImageUrl}
                          onCancelImport={() => { setImportingSceneId(null); setImportUrl('') }}
                          onGenerateScene={handleGenerateScene}
                          onAnimateScene={handleAnimateScene}
                          onImageClick={handleImageClick}
                          onImageError={handleImageError}
                        />
                      )}
                    </SortableSceneRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* Input Section - Fixed at Bottom */}
      {!architect.strategy && (
        <div className="fixed bottom-0 left-0 w-full p-6 bg-zinc-950/80 backdrop-blur-2xl border-t border-zinc-800/50 z-40">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Length Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-medium uppercase tracking-wider">
                <span className="text-zinc-500">Script Duration</span>
                <span className="text-amber-500">{Math.floor(scriptLength / 60)}m {scriptLength % 60}s</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="5"
                value={scriptLength}
                onChange={(e) => setScriptLength(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                <span>30s</span>
                <span>60s</span>
                <span>90s</span>
                <span>120s</span>
              </div>
            </div>

            {draftRecovered && topic && !architect.strategy && (
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-amber-400 font-medium">Draft recovered — pick up where you left off</span>
                <button
                  onClick={() => { setTopic(''); setDraftRecovered(false) }}
                  className="text-zinc-500 hover:text-white text-xs ml-4 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                >
                  Discard
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDesign()}
                placeholder="Enter a video concept (e.g., 'The Reality Glitch', 'Cyberpunk Detective')..."
                className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:outline-none transition-all placeholder:text-zinc-600"
              />
              <button
                onClick={handleDesign}
                disabled={!topic || isDesigning || !(provider === 'google' ? googleApiKey : kieApiKey)}
                className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-8 py-4 rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
              >
                {isDesigning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Clapperboard className="w-5 h-5" />
                )}
                {isDesigning ? 'Designing...' : 'Design'}
              </button>
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

      {/* Project Library Modal */}
      <ProjectLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onLoad={handleLoad}
      />

      {/* API Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <ApiKeyInput
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Confirm New Project Dialog (#9) */}
      <ConfirmDialog
        open={showNewProjectConfirm}
        onOpenChange={setShowNewProjectConfirm}
        title="Start New Project?"
        description="All unsaved changes will be lost. Make sure you've saved your flow first."
        confirmLabel="New Project"
        variant="danger"
        onConfirm={handleConfirmNewProject}
      />
    </div>
  )
}
