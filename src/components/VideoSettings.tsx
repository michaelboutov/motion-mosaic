'use client'

import { Sparkles } from 'lucide-react'

export interface VideoSettingsValues {
  model: 'seedance' | 'grok'
  prompt: string
  grokDuration: '6' | '10'
  grokMode: 'normal' | 'fun'
}

interface VideoSettingsProps {
  values: VideoSettingsValues
  onChange: (updates: Partial<VideoSettingsValues>) => void
  accentColor?: 'amber' | 'purple'
  compact?: boolean
}

const colorMap = {
  amber: {
    active: 'bg-amber-500/10 border-amber-500 text-amber-500',
    inactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800',
  },
  purple: {
    active: 'bg-purple-500/10 border-purple-500 text-purple-400',
    inactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800',
  },
}

/**
 * Reusable video generation settings panel.
 * Used in MotionStudio (initial + regen) and SceneRow.
 */
export default function VideoSettings({ values, onChange, accentColor = 'amber', compact = false }: VideoSettingsProps) {
  const colors = colorMap[accentColor]
  const textSize = compact ? 'text-xs' : 'text-sm'
  const labelSize = compact ? 'text-xs' : 'text-sm'
  const subLabelSize = compact ? 'text-xs' : 'text-xs'

  return (
    <div className="space-y-4">
      {/* Model Selector */}
      <div>
        <label className={`block ${subLabelSize} font-medium text-zinc-400 mb-2`}>Model</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ model: 'seedance' })}
            className={`flex-1 py-2 px-3 rounded-lg border ${textSize} font-medium transition-all ${
              values.model === 'seedance' ? colors.active : colors.inactive
            }`}
          >
            Seedance (Standard)
          </button>
          <button
            onClick={() => onChange({ model: 'grok' })}
            className={`flex-1 py-2 px-3 rounded-lg border ${textSize} font-medium transition-all ${
              values.model === 'grok' ? colors.active : colors.inactive
            }`}
          >
            Grok (High Quality)
          </button>
        </div>
      </div>

      {/* Grok-specific options */}
      {values.model === 'grok' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block ${subLabelSize} font-medium text-zinc-500 mb-1.5`}>Duration</label>
            <div className="flex gap-1">
              {(['6', '10'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ grokDuration: d })}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors border ${
                    values.grokDuration === d ? colors.active : colors.inactive
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={`block ${subLabelSize} font-medium text-zinc-500 mb-1.5`}>Mode</label>
            <div className="flex gap-1">
              {(['normal', 'fun'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ grokMode: m })}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors border ${
                    values.grokMode === m ? colors.active : colors.inactive
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Prompt */}
      <div>
        <label className={`block ${labelSize} font-medium text-zinc-400 mb-2`}>Video Prompt</label>
        <textarea
          value={values.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Describe how you want to animate the image..."
          className={`w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 ${textSize} text-white placeholder-zinc-600 focus:ring-2 focus:ring-${accentColor}-500/50 focus:border-${accentColor}-500/50 outline-none resize-none h-20`}
        />
      </div>
    </div>
  )
}
