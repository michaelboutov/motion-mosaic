'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { SlidersHorizontal, Sparkles } from 'lucide-react'

export interface GenerationSettings {
  aspectRatio: string
  speed: string
  variety: number
}

interface PromptInputProps {
  onGenerate: (prompt: string, settings: GenerationSettings) => void
}

export default function PromptInput({ onGenerate }: PromptInputProps) {
  const { prompt, setPrompt, isGeneratingImages, kieApiKey } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [speed, setSpeed] = useState('relaxed')
  const [variety, setVariety] = useState(10)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [prompt])

  const handleGenerate = async () => {
    if (!prompt.trim() || isGeneratingImages || !kieApiKey) return
    onGenerate(prompt, { aspectRatio, speed, variety })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 w-full p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 z-40">
        <div className="max-w-3xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGeneratingImages}
              maxLength={4000}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 pr-16 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none h-14 min-h-[56px] max-h-32 disabled:opacity-50"
              placeholder="Describe your vision (e.g., 'Cyberpunk street food vendor in rain')..."
            />
            <span className={`absolute right-3 bottom-1.5 text-[10px] font-mono tabular-nums transition-colors ${
              prompt.length > 3800 ? 'text-red-400' : prompt.length > 3000 ? 'text-amber-400' : 'text-zinc-600'
            }`}>
              {prompt.length}/4000
            </span>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            disabled={isGeneratingImages}
          >
            <SlidersHorizontal className="w-6 h-6" />
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGeneratingImages || !kieApiKey}
            className="bg-white text-black font-bold px-6 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center gap-2"
          >
            {isGeneratingImages ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel — anchored above the bottom bar */}
      {showSettings && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
        <div className="fixed bottom-[calc(4rem+1.5rem+1px)] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <h3 className="text-white font-medium mb-3">Generation Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-400 text-sm">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="4:3">4:3 (Standard)</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-sm">Speed</label>
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="relaxed">Relaxed</option>
                <option value="fast">Fast</option>
                <option value="turbo">Turbo</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-zinc-400 text-sm">Variety</label>
                <span className="text-xs text-amber-400 font-mono">{variety}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5"
                value={variety}
                onChange={(e) => setVariety(parseInt(e.target.value))}
                className="w-full mt-1 accent-amber-500"
              />
            </div>
          </div>
        </div>
        </>
      )}
    </>
  )
}
