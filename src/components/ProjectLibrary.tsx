'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { X, Calendar, ArrowRight, Trash2, FolderOpen, Film } from 'lucide-react'
import { useAppStore, SavedProject } from '@/lib/store'
import ConfirmDialog from '@/components/ConfirmDialog'

interface ProjectLibraryProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (project: SavedProject) => void
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })} • ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`
}

export default function ProjectLibrary({ isOpen, onClose, onLoad }: ProjectLibraryProps) {
  const { savedProjects, deleteProject } = useAppStore()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Project Library</h2>
                  <p className="text-sm text-zinc-400">Manage your saved flows and generations</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {savedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700/50">
                    <Film className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No saved projects</h3>
                  <p className="text-sm text-zinc-500 max-w-xs">
                    Generate a flow and save it to see it here. Your projects are stored locally.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedProjects.map((project) => (
                    <motion.div
                      key={project.id}
                      layoutId={`project-${project.id}`}
                      className="group bg-zinc-950/50 border border-zinc-800/50 hover:border-amber-500/30 rounded-xl p-4 transition-all hover:bg-zinc-900/80 cursor-pointer relative overflow-hidden"
                      onClick={() => onLoad(project)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-white text-lg group-hover:text-amber-400 transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(project.createdAt)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(project.id)
                          }}
                          className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800/50">
                          <p className="text-xs text-zinc-400 line-clamp-2 italic">
                            "{project.architect.strategy?.concept || 'No concept'}"
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex gap-2">
                            <span className="px-2 py-1 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50">
                              {project.architect.scenes.length} Scenes
                            </span>
                            <span className="px-2 py-1 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700/50">
                              {project.architect.scenes.reduce((acc, s) => acc + s.images.length, 0)} Images
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-amber-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                            Open <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {/* Thumbnail Background if available */}
                      {(() => {
                        const firstImage = project.architect.scenes
                          .flatMap(s => s.images)
                          .find(img => img.url && img.status === 'done')
                        
                        if (firstImage) {
                          return (
                            <div className="absolute inset-0 z-[-1] opacity-20 group-hover:opacity-30 transition-opacity">
                              <img src={firstImage.url} alt="" className="w-full h-full object-cover grayscale mix-blend-luminosity" />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/20" />
                            </div>
                          )
                        }
                        return null
                      })()}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
            title="Delete Project?"
            description="This project will be permanently removed from your library. This action cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => {
              if (deleteTarget) deleteProject(deleteTarget)
              setDeleteTarget(null)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
