'use client'

import { useAppStore } from '@/lib/store'
import { Sparkles } from 'lucide-react'

export default function StrategyCard() {
  const { architect } = useAppStore()

  if (!architect.strategy) return null

  return (
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
  )
}
