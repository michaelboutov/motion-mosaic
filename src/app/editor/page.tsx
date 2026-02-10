'use client'

import { useEffect, useState, useRef } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import { useToastStore } from '@/lib/toastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import EditorToolbar from '@/components/editor/EditorToolbar'
import EditorPreview from '@/components/editor/EditorPreview'
import EditorTimeline from '@/components/editor/EditorTimeline'
import ClipInspector from '@/components/editor/ClipInspector'
import ExportDialog from '@/components/editor/ExportDialog'
import ImportMediaModal from '@/components/editor/ImportMediaModal'
import ToastContainer from '@/components/editor/ToastContainer'
import { Film, Music, Type, Plus, ArrowLeft, Pencil, Link2 } from 'lucide-react'

export default function EditorPage() {
  const { clips, tracks, addClip, addTrack, addAudioToEditor, addVideosToEditor, project, setProject } = useEditorStore()
  const { addToast } = useToastStore()
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importType, setImportType] = useState<'video' | 'audio'>('video')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [projectName, setProjectName] = useState(project.name)
  const addPanelRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Check if we have clips loaded (from "Send to Editor" flow)
  const hasClips = clips.length > 0

  const handleBack = () => {
    window.history.back()
  }

  // Sync project name
  useEffect(() => { setProjectName(project.name) }, [project.name])

  const handleNameSubmit = () => {
    const trimmed = projectName.trim() || 'Untitled Project'
    setProject({ name: trimmed })
    setProjectName(trimmed)
    setIsEditingName(false)
  }

  // Close add-panel on outside click
  useEffect(() => {
    if (!showAddPanel) return
    const handleClickOutside = (e: MouseEvent) => {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setShowAddPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddPanel])

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select()
  }, [isEditingName])

  // ── Keyboard Shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Space → Play/Pause (only if not in input)
      if (e.code === 'Space' && !isInput) {
        e.preventDefault()
        const s = useEditorStore.getState()
        s.setIsPlaying(!s.isPlaying)
        return
      }

      // Delete / Backspace → Remove selected clips (multi-select aware)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        const s = useEditorStore.getState()
        if (s.selectedClipIds.length > 1) {
          e.preventDefault(); s.removeSelectedClips(); addToast(`${s.selectedClipIds.length} clips deleted`)
        } else if (s.selectedClipId) {
          e.preventDefault(); s.removeClip(s.selectedClipId); addToast('Clip deleted')
        }
        return
      }

      // Cmd+Z → Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().undo()
        addToast('Undone')
        return
      }

      // Cmd+Shift+Z or Cmd+Y → Redo
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useEditorStore.getState().redo()
        addToast('Redone')
        return
      }

      // S → Split selected clip at playhead
      if (e.key === 's' && !isInput && !(e.metaKey || e.ctrlKey)) {
        const s = useEditorStore.getState()
        if (s.selectedClipId) { e.preventDefault(); s.splitClip(s.selectedClipId, s.currentTime); addToast('Clip split') }
        return
      }

      // D → Duplicate selected clip
      if (e.key === 'd' && !isInput && !(e.metaKey || e.ctrlKey)) {
        const s = useEditorStore.getState()
        if (s.selectedClipId) { e.preventDefault(); s.duplicateClip(s.selectedClipId); addToast('Clip duplicated') }
        return
      }

      // M → Add marker at playhead
      if (e.key === 'm' && !isInput && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const s = useEditorStore.getState()
        s.addMarker(s.currentTime)
        addToast('Marker added')
        return
      }

      // , and . → Frame step backward/forward
      if ((e.key === ',' || e.key === '.') && !isInput) {
        e.preventDefault()
        const s = useEditorStore.getState()
        const frameStep = 1 / s.project.fps
        const delta = e.key === ',' ? -frameStep : frameStep
        s.setCurrentTime(Math.max(0, s.currentTime + delta))
        return
      }

      // Cmd+I → Import media
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        setIsImportOpen(true)
        return
      }

      // Escape → Deselect clip / close panels
      if (e.key === 'Escape') {
        if (showAddPanel) { setShowAddPanel(false); return }
        if (isEditingName) { setIsEditingName(false); return }
        useEditorStore.getState().setSelectedClipId(null)
        return
      }

      // Left/Right arrow → Nudge playhead
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isInput) {
        e.preventDefault()
        const s = useEditorStore.getState()
        const step = e.shiftKey ? 1 : 0.1
        const delta = e.key === 'ArrowLeft' ? -step : step
        s.setCurrentTime(Math.max(0, s.currentTime + delta))
        return
      }

      // Cmd+E → Export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        setIsExportOpen(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddPanel, isEditingName, addToast])

  // Add a text overlay clip
  const handleAddText = () => {
    const textTrack = tracks.find(t => t.type === 'text')
    if (!textTrack) return
    const existingTextClips = clips.filter(c => c.trackId === textTrack.id)
    const lastEnd = existingTextClips.length > 0
      ? Math.max(...existingTextClips.map(c => c.startTime + c.duration))
      : 0

    addClip({
      trackId: textTrack.id,
      type: 'text',
      startTime: lastEnd,
      duration: 3,
      originalDuration: 3,
      trimStart: 0,
      trimEnd: 0,
      label: 'Text Overlay',
      volume: 1,
      text: 'Your text here',
      fontSize: 24,
      color: '#ffffff',
    })
    setShowAddPanel(false)
  }

  const handleOpenImport = (type: 'video' | 'audio') => {
    setImportType(type)
    setIsImportOpen(true)
    setShowAddPanel(false)
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Toolbar */}
      <EditorToolbar onExport={() => setIsExportOpen(true)} onBack={handleBack}>
        {/* Project name — inline editable */}
        <div className="flex items-center gap-1.5 ml-2">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); if (e.key === 'Escape') setIsEditingName(false) }}
              className="bg-zinc-800 border border-amber-500/50 rounded-lg px-2 py-0.5 text-xs text-white font-medium focus:outline-none w-40"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-all group"
            >
              <span className="font-medium truncate max-w-[180px]">{project.name}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </EditorToolbar>

      {/* Main editor area — resizable panels */}
      <PanelGroup className="flex-1 min-h-0" orientation="horizontal">
        {/* Left: Preview + Timeline */}
        <Panel defaultSize={75} minSize={50}>
          <PanelGroup orientation="vertical" style={{ height: '100%' }}>
            {/* Preview panel */}
            <Panel defaultSize={65} minSize={30}>
              <div className="h-full relative flex">
                {hasClips ? (
                  <EditorPreview />
                ) : (
                  <EmptyState onAddPanel={() => setShowAddPanel(true)} />
                )}

                {/* Floating add button */}
                {hasClips && (
                  <div ref={addPanelRef} className="absolute top-3 left-3 z-20">
                    <button
                      onClick={() => setShowAddPanel(!showAddPanel)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>

                    {/* Add dropdown */}
                    <AnimatePresence>
                      {showAddPanel && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          className="absolute top-full mt-1 left-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-30"
                        >
                          <button
                            onClick={handleAddText}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-all text-left"
                          >
                            <Type className="w-4 h-4 text-sky-400" />
                            <div>
                              <p className="text-sm text-white">Text Overlay</p>
                              <p className="text-[10px] text-zinc-500">Add subtitle or title</p>
                            </div>
                          </button>
                          <button
                            onClick={() => handleOpenImport('video')}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-all text-left border-t border-zinc-800/50"
                          >
                            <Link2 className="w-4 h-4 text-amber-400" />
                            <div>
                              <p className="text-sm text-white">Import Video</p>
                              <p className="text-[10px] text-zinc-500">File or URL</p>
                            </div>
                          </button>
                          <button
                            onClick={() => handleOpenImport('audio')}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-all text-left border-t border-zinc-800/50"
                          >
                            <Music className="w-4 h-4 text-emerald-400" />
                            <div>
                              <p className="text-sm text-white">Import Audio</p>
                              <p className="text-[10px] text-zinc-500">File or URL</p>
                            </div>
                          </button>
                          <button
                            onClick={() => { addTrack('video'); setShowAddPanel(false) }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-all text-left border-t border-zinc-800/50"
                          >
                            <Film className="w-4 h-4 text-purple-400" />
                            <div>
                              <p className="text-sm text-white">Video Track</p>
                              <p className="text-[10px] text-zinc-500">Add extra video layer</p>
                            </div>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </Panel>

            {/* Resize handle between preview and timeline */}
            <PanelResizeHandle className="h-1 bg-zinc-800/60 hover:bg-amber-500/40 transition-colors cursor-row-resize group relative">
              <div className="absolute inset-x-0 -top-1 -bottom-1" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full bg-zinc-600 group-hover:bg-amber-500/60 transition-colors" />
            </PanelResizeHandle>

            {/* Timeline panel */}
            <Panel defaultSize={35} minSize={15}>
              <EditorTimeline />
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Resize handle between main and inspector */}
        <PanelResizeHandle className="w-1 bg-zinc-800/60 hover:bg-amber-500/40 transition-colors cursor-col-resize group relative">
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-zinc-600 group-hover:bg-amber-500/60 transition-colors" />
        </PanelResizeHandle>

        {/* Inspector panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <ClipInspector />
        </Panel>
      </PanelGroup>

      {/* Modals */}
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <ImportMediaModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} defaultType={importType} />

      {/* Toasts */}
      <ToastContainer />

      {/* Keyboard shortcut toast (bottom-left) */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
        <AnimatePresence>
          {!hasClips && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800/60 rounded-xl px-4 py-3 shadow-2xl"
            >
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Shortcuts</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                {[
                  ['Space', 'Play / Pause'],
                  ['S', 'Split clip'],
                  ['D', 'Duplicate clip'],
                  ['Del', 'Delete clip'],
                  ['\u2190 \u2192', 'Nudge playhead'],
                  ['\u2318+Z', 'Undo'],
                  ['\u2318+E', 'Export'],
                  ['\u2318+I', 'Import'],
                  ['M', 'Add marker'],
                  [', .', 'Frame step'],
                  ['Esc', 'Deselect'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700/50 rounded text-[9px] font-mono text-zinc-400 min-w-[28px] text-center">{key}</kbd>
                    <span className="text-zinc-500">{desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyState({ onAddPanel }: { onAddPanel: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        {/* Decorative */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 border border-zinc-800/50 rotate-6" />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-zinc-800/50 -rotate-6" />
          <div className="relative w-full h-full rounded-3xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center">
            <Film className="w-10 h-10 text-zinc-600" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Video Editor</h2>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          Your timeline is empty. Send videos from the <span className="text-amber-400">Architect</span> or <span className="text-purple-400">Motion Studio</span>, or add clips manually.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-white transition-all border border-zinc-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={onAddPanel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-sm font-semibold text-black hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Clips
          </button>
        </div>
      </motion.div>
    </div>
  )
}
