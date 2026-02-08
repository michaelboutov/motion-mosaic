'use client'

interface AnimatedSpinnerProps {
  label: string
  subtitle?: string
  color?: 'amber' | 'violet' | 'orange'
}

const colorGradients: Record<string, string> = {
  amber: '#f59e0b',
  violet: '#8b5cf6',
  orange: '#f97316',
}

/**
 * Reusable conic-gradient animated spinner with label.
 * Replaces 4+ duplicated spinner blocks in MotionStudio.
 */
export default function AnimatedSpinner({ label, subtitle, color = 'amber' }: AnimatedSpinnerProps) {
  const gradient = colorGradients[color]

  return (
    <div className="text-center px-4">
      <div className="group relative inline-flex h-12 overflow-hidden rounded-full p-[1px]">
        <span
          className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite]"
          style={{
            background: `conic-gradient(from 90deg at 50% 50%, #E2E8F0 0%, ${gradient} 50%, #E2E8F0 100%)`,
          }}
        />
        <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          {label}
        </span>
      </div>
      {subtitle && <p className="mt-4 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  )
}
