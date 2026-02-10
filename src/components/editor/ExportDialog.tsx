'use client'

import { useState } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Loader2, CheckCircle, AlertCircle, Film, Settings2 } from 'lucide-react'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

type ExportFormat = 'mp4' | 'webm'
type ExportQuality = '720p' | '1080p'

export default function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { clips, tracks, isExporting, exportProgress, setIsExporting, setExportProgress, project } = useEditorStore()
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [quality, setQuality] = useState<ExportQuality>('720p')
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const videoClips = clips.filter(c => {
    const track = tracks.find(t => t.id === c.trackId)
    return track?.type === 'video'
  })

  const handleExport = async () => {
    if (videoClips.length === 0) {
      setError('No video clips to export. Add clips to the timeline first.')
      return
    }

    setError(null)
    setIsExporting(true)
    setExportProgress(0)
    setIsDone(false)

    try {
      // Dynamic import FFmpeg.wasm
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

      setExportProgress(5)

      const ffmpeg = new FFmpeg()

      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        setExportProgress(Math.min(95, 10 + progress * 85))
      })

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      setExportProgress(10)

      // Sort video clips by start time
      const sorted = [...videoClips].sort((a, b) => a.startTime - b.startTime)

      // Write each clip to FFmpeg filesystem and trim individually
      const trimmedFiles: string[] = []
      for (let i = 0; i < sorted.length; i++) {
        const clip = sorted[i]
        if (!clip.sourceUrl) continue
        const rawFile = `raw_${i}.mp4`
        const trimmedFile = `trimmed_${i}.mp4`
        const fetchUrl = clip.sourceUrl.startsWith('http') ? `/api/media-proxy?url=${encodeURIComponent(clip.sourceUrl)}` : clip.sourceUrl
        const response = await fetch(fetchUrl)
        const data = await response.arrayBuffer()
        await ffmpeg.writeFile(rawFile, new Uint8Array(data))

        // Trim clip respecting trimStart and effective duration
        const hasTrim = clip.trimStart > 0.05 || clip.trimEnd > 0.05
        if (hasTrim) {
          await ffmpeg.exec([
            '-ss', clip.trimStart.toFixed(3),
            '-i', rawFile,
            '-t', clip.duration.toFixed(3),
            '-c', 'copy',
            '-y', trimmedFile,
          ])
          trimmedFiles.push(trimmedFile)
        } else {
          trimmedFiles.push(rawFile)
        }
        setExportProgress(10 + (i / sorted.length) * 30)
      }

      if (trimmedFiles.length === 0) {
        throw new Error('No valid video files to export')
      }

      // Build concat file
      let concatContent = ''
      for (const f of trimmedFiles) {
        concatContent += `file '${f}'\n`
      }
      await ffmpeg.writeFile('concat.txt', concatContent)

      setExportProgress(45)

      // Find audio clips to mix in
      const audioClips = clips.filter(c => {
        const track = tracks.find(t => t.id === c.trackId)
        return track?.type === 'audio' && c.sourceUrl
      })

      // Write audio files
      const audioInputArgs: string[] = []
      for (let i = 0; i < audioClips.length; i++) {
        const aClip = audioClips[i]
        if (!aClip.sourceUrl) continue
        const audioFile = `audio_${i}.mp3`
        const audioFetchUrl = aClip.sourceUrl.startsWith('http') ? `/api/media-proxy?url=${encodeURIComponent(aClip.sourceUrl)}` : aClip.sourceUrl
        const resp = await fetch(audioFetchUrl)
        const aData = await resp.arrayBuffer()
        await ffmpeg.writeFile(audioFile, new Uint8Array(aData))
        audioInputArgs.push('-i', audioFile)
      }

      // Resolution
      const scale = quality === '1080p' ? '1080:1920' : '720:1280'
      const outputFile = `output.${format}`

      // Build FFmpeg command
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        ...audioInputArgs,
        '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', format === 'mp4' ? 'libx264' : 'libvpx-vp9',
        '-preset', 'fast',
        '-crf', '23',
      ]

      // If we have audio inputs, mix them with the video audio
      if (audioClips.length > 0) {
        // Use amerge/amix to combine all audio sources
        const totalInputs = 1 + audioClips.length // concat video + audio files
        const filterParts = Array.from({ length: totalInputs }, (_, i) => `[${i}:a]`).join('')
        ffmpegArgs.push('-filter_complex', `${filterParts}amix=inputs=${totalInputs}:duration=longest`)
      }

      ffmpegArgs.push('-y', outputFile)

      await ffmpeg.exec(ffmpegArgs)

      setExportProgress(95)

      // Read output and download
      const outputData = await ffmpeg.readFile(outputFile)
      const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportProgress(100)
      setIsDone(true)
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <Download className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Export Video</h2>
                  <p className="text-xs text-zinc-500">{videoClips.length} clip{videoClips.length !== 1 ? 's' : ''} on timeline</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings */}
            <div className="p-5 space-y-4">
              {/* Format */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mp4', 'webm'] as ExportFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      disabled={isExporting}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        format === f
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600'
                      } disabled:opacity-50`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['720p', '1080p'] as ExportQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      disabled={isExporting}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        quality === q
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600'
                      } disabled:opacity-50`}
                    >
                      {q} {q === '1080p' && <span className="text-[9px] text-zinc-600 ml-1">(slower)</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              {(isExporting || isDone) && (
                <div className="space-y-2">
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${exportProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    {isExporting && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                        <span className="text-xs text-zinc-400">
                          {exportProgress < 10 ? 'Loading FFmpeg...' :
                           exportProgress < 45 ? 'Preparing clips...' :
                           exportProgress < 95 ? 'Encoding video...' : 'Finalizing...'}
                        </span>
                      </div>
                    )}
                    {isDone && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">Export complete!</span>
                      </div>
                    )}
                    <span className="text-xs text-zinc-500 font-mono">{Math.round(exportProgress)}%</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-800/60 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-all"
              >
                {isDone ? 'Done' : 'Cancel'}
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || videoClips.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export {format.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
