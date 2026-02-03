'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Eye, EyeOff, Key } from 'lucide-react'

export default function ApiKeyInput() {
  const { apiKey, setApiKey } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [inputKey, setInputKey] = useState(apiKey || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputKey.trim()) {
      setApiKey(inputKey.trim())
    }
  }

  const handleSkip = () => {
    // Allow skipping for demo purposes
    setApiKey('demo-key')
  }

  if (apiKey) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-[0_0_50px_rgba(139,92,246,0.1)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Key className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Welcome to MotionMosaic</h1>
            <p className="text-sm text-zinc-400 mt-1">Enter your KIE.AI API key to get started</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!inputKey.trim()}
              className="flex-1 bg-white text-black font-medium py-3 rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-3 text-zinc-400 hover:text-white transition-colors"
            >
              Demo
            </button>
          </div>
        </form>

        <div className="mt-6 p-3 bg-zinc-800/50 rounded-xl">
          <p className="text-xs text-zinc-500">
            Get your API key from{' '}
            <a 
              href="https://kie.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline"
            >
              kie.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
