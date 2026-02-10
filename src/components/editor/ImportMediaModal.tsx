'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Link2, Upload, Film, Music, Loader2 } from 'lucide-react'
import { probeVideoDuration, probeAudioDuration } from '@/lib/probeVideoDuration'
import { useEditorStore } from '@/lib/editorStore'
import { useToastStore } from '@/lib/toastStore'

type MediaType = 'video' | 'audio'

interface ImportMediaModalProps {
  isOpen: boolean
  onClose: () => void
  defaultType?: MediaType
}

export default function ImportMediaModal({ isOpen, onClose, defaultType = 'video' }: ImportMediaModalProps) {
  const { addVideosToEditor, addAudioToEditor } = useEditorStore()
  const { addToast } = useToastStore()

  const [mediaType, setMediaType] = useState<MediaType>(defaultType)
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportUrl = async () => {
    if (!url.trim()) return
    setIsLoading(true)
    try {
      if (mediaType === 'video') {
        const duration = await probeVideoDuration(url.trim())
        addVideosToEditor([{
          url: url.trim(),
          label: url.split('/').pop()?.split('?')[0]?.slice(0, 40) || 'Imported Video',
          duration,
        }])
        addToast('Video imported', 'success')
      } else {
        const duration = await probeAudioDuration(url.trim())
        addAudioToEditor({ url: url.trim(), label: 'Imported Audio', duration })
        addToast('Audio imported', 'success')
      }
      setUrl('')
      onClose()
    } catch (err) {
      addToast('Failed to import media', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsLoading(true)
    try {
      for (const file of Array.from(files)) {
        const objectUrl = URL.createObjectURL(file)
        const isVideo = file.type.startsWith('video/')
        const isAudio = file.type.startsWith('audio/')

        if (isVideo) {
          const duration = await getMediaDuration(objectUrl, 'video')
          addVideosToEditor([{
            url: objectUrl,
            label: file.name.slice(0, 40),
            duration,
          }])
          addToast(`${file.name} added`, 'success')
        } else if (isAudio) {
          const duration = await getMediaDuration(objectUrl, 'audio')
          addAudioToEditor({ url: objectUrl, label: file.name.slice(0, 40), duration })
          addToast(`${file.name} added`, 'success')
        } else {
          addToast(`Unsupported file: ${file.name}`, 'error')
        }
      }
      onClose()
    } catch {
      addToast('Failed to import file', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [addVideosToEditor, addAudioToEditor, addToast, onClose])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')?.trim()
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault()
      setUrl(text)
    }
  }, [])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="w-[480px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-base font-semibold text-white">Import Media</h2>
            <button onClick={onClose} className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-1 px-5 pt-4">
            <button
              onClick={() => setMediaType('video')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mediaType === 'video'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Film className="w-4 h-4" /> Video
            </button>
            <button
              onClick={() => setMediaType('audio')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mediaType === 'audio'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Music className="w-4 h-4" /> Audio
            </button>
          </div>

          {/* Dropzone */}
          <div className="px-5 py-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragOver
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
              }`}
            >
              <div className={`p-3 rounded-xl ${isDragOver ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                <Upload className={`w-6 h-6 ${isDragOver ? 'text-amber-400' : 'text-zinc-500'}`} />
              </div>
              <div className="text-center">
                <p className="text-sm text-zinc-300 font-medium">
                  {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  or click to browse • {mediaType === 'video' ? 'MP4, WebM, MOV' : 'MP3, WAV, OGG'}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={mediaType === 'video' ? 'video/*' : 'audio/*'}
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-5">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">or paste URL</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* URL input */}
          <div className="px-5 py-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => e.key === 'Enter' && handleImportUrl()}
                  placeholder={`Paste ${mediaType} URL...`}
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <button
                onClick={handleImportUrl}
                disabled={!url.trim() || isLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
              </button>
            </div>
          </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="px-5 pb-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-sm text-amber-300">Detecting duration...</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function getMediaDuration(url: string, type: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(type)
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      resolve(el.duration || 5)
      URL.revokeObjectURL(url)
    }
    el.onerror = () => resolve(5)
    el.src = url
  })
}
