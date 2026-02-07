'use client'

import { useAppStore } from '@/lib/store'
import { Film, Sparkles, RefreshCw, Play, Loader2 } from 'lucide-react'

interface ScriptCardProps {
  onGenerateVoiceover: () => void
}

export default function ScriptCard({ onGenerateVoiceover }: ScriptCardProps) {
  const { architect, kieApiKey } = useAppStore()

  if (!architect.script) return null

  return (
    <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-6 space-y-4 shadow-xl">
      <h3 className="text-lg font-bold text-purple-200 flex items-center gap-2">
        <Film className="w-5 h-5" /> Audio Script
      </h3>
      <div className="space-y-3 text-sm">
        <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-purple-500/20">
          <span className="text-purple-400 block text-xs mb-1 uppercase tracking-wider">Scene 1 (Hook)</span>
          <p className="italic text-zinc-300">"{architect.script.scene1}"</p>
        </div>
        <div className="p-3 bg-zinc-950/50 backdrop-blur-sm rounded-lg border border-zinc-800/50">
          <span className="text-zinc-500 block text-xs mb-1 uppercase tracking-wider">Narration</span>
          <p className="text-zinc-300 leading-relaxed">{architect.script.narration}</p>
        </div>

        {/* Voiceover Section */}
        <div className="pt-2 border-t border-zinc-800/50 mt-4 flex flex-col gap-3">
          {!architect.script.voiceoverUrl ? (
            <button
              onClick={onGenerateVoiceover}
              disabled={architect.script.isGeneratingVoiceover || !kieApiKey}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
            >
              {architect.script.isGeneratingVoiceover ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {architect.script.isGeneratingVoiceover ? 'Generating Voice...' : 'Generate Voiceover (ElevenLabs)'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-purple-400">
                <span>AI Voiceover Ready</span>
                <button 
                  onClick={onGenerateVoiceover}
                  className="hover:text-white transition-colors"
                >
                  Regenerate
                </button>
              </div>
              <audio 
                src={architect.script.voiceoverUrl} 
                controls 
                className="w-full h-8 accent-purple-500"
              />
            </div>
          )}
        </div>
        
        {/* Loop Verification UI */}
        <div className="mt-4 p-3 bg-amber-500/5 backdrop-blur-sm rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-3 h-3 text-amber-500" />
            <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">Infinite Loop Check</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 italic">"...{architect.script.narration?.split('.').pop()?.trim()}"</span>
            <Play className="w-2 h-2 text-zinc-700" />
            <span className="text-amber-200 font-bold">"{architect.script.scene1?.split(' ').slice(0, 5).join(' ')}..."</span>
          </div>
        </div>
      </div>
    </div>
  )
}
