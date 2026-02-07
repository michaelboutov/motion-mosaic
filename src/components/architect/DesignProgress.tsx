'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Lightbulb, FileText, Film } from 'lucide-react'

const STEPS = [
  { label: 'Generating strategy…', icon: Lightbulb, duration: 4000 },
  { label: 'Writing script…', icon: FileText, duration: 6000 },
  { label: 'Building scenes…', icon: Film, duration: 8000 },
]

export default function DesignProgress() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0
    STEPS.forEach((step, i) => {
      if (i === 0) return
      elapsed += step.duration
      timers.push(setTimeout(() => setActiveStep(i), elapsed))
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-zinc-950/60 backdrop-blur-md">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-10 text-center max-w-md shadow-2xl">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Designing Your Flow</h2>
        <p className="text-zinc-500 text-sm mb-8">This typically takes 15–30 seconds</p>

        <div className="space-y-3 text-left">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const state = i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending'
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                  state === 'active'
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : state === 'done'
                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                    : 'bg-zinc-800/30 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  state === 'active'
                    ? 'bg-amber-500/20'
                    : state === 'done'
                    ? 'bg-emerald-500/20'
                    : 'bg-zinc-800/50'
                }`}>
                  {state === 'active' ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  ) : state === 'done' ? (
                    <Icon className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Icon className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  state === 'active'
                    ? 'text-amber-400'
                    : state === 'done'
                    ? 'text-emerald-400'
                    : 'text-zinc-600'
                }`}>
                  {state === 'done' ? step.label.replace('…', ' ✓') : step.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
