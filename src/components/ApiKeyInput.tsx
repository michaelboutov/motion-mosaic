'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Eye, EyeOff, Key, X, Settings2, ShieldCheck, Zap, Sparkles, Globe, Trash2, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'

interface ApiKeyInputProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function ApiKeyInput({ isOpen = false, onClose }: ApiKeyInputProps) {
  const { 
    kieApiKey, 
    googleApiKey, 
    setKieApiKey, 
    setGoogleApiKey, 
    provider, 
    setProvider,
    kieModel,
    setKieModel,
    clearPersistence
  } = useAppStore()
  const [showKieKey, setShowKieKey] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)
  const [inputKieKey, setInputKieKey] = useState(kieApiKey || '')
  const [inputGoogleKey, setInputGoogleKey] = useState(googleApiKey || '')

  // Update local state when store changes
  useEffect(() => {
    if (kieApiKey !== null) setInputKieKey(kieApiKey)
    if (googleApiKey !== null) setInputGoogleKey(googleApiKey)
  }, [kieApiKey, googleApiKey])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setKieApiKey(inputKieKey.trim() || null)
    setGoogleApiKey(inputGoogleKey.trim() || null)
    
    if (onClose) onClose()
  }

  const handleSkip = () => {
    setKieApiKey('demo-key')
    if (onClose) onClose()
  }

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all data? This will remove all API keys, projects, and current progress.')) {
      clearPersistence()
      setInputKieKey('')
      setInputGoogleKey('')
      if (onClose) onClose()
    }
  }

  const showModal = isOpen || !kieApiKey

  if (!showModal) {
    return null
  }

  const canClose = !!kieApiKey && !!onClose

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800/50 rounded-[2rem] p-8 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        {/* Background Gradients */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full" />

        {canClose && (
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-all rounded-full hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-700/50 shadow-inner">
            <Settings2 className="w-6 h-6 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {kieApiKey ? 'System Configuration' : 'Getting Started'}
            </h1>
            <p className="text-sm text-zinc-400 font-medium">
              Configure your intelligence engines and creative tools
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Provider Selection Card */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
              <Zap className="w-3 h-3" /> Architect Intelligence
            </label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-zinc-900/50 rounded-[1.25rem] border border-zinc-800/50">
              <button
                type="button"
                onClick={() => setProvider('kie')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                  provider === 'kie' 
                    ? 'bg-zinc-800 text-amber-400 shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${provider === 'kie' ? 'text-amber-400' : 'text-zinc-500'}`} />
                Kie.ai
              </button>
              <button
                type="button"
                onClick={() => setProvider('google')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                  provider === 'google' 
                    ? 'bg-zinc-800 text-blue-400 shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                <Globe className={`w-3.5 h-3.5 ${provider === 'google' ? 'text-blue-400' : 'text-zinc-500'}`} />
                Google Gemini
              </button>
            </div>
          </div>

          {/* Kie.ai LLM Model Selector */}
          {provider === 'kie' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                <Cpu className="w-3 h-3" /> Kie.ai LLM Model
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-900/50 rounded-[1.25rem] border border-zinc-800/50">
                {[
                  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Fast & smart' },
                  { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5', desc: 'Balanced' },
                  { id: 'gemini-2.0-flash', label: 'Gemini 2.0', desc: 'Stable' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setKieModel(m.id)}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-[10px] font-bold transition-all ${
                      kieModel === m.id
                        ? 'bg-zinc-800 text-amber-400 shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                    }`}
                  >
                    <span className="text-xs">{m.label}</span>
                    <span className={`text-[9px] ${kieModel === m.id ? 'text-amber-400/60' : 'text-zinc-600'}`}>{m.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed ml-1">
                LLM used by Architect, Director AI, and Prompt Enhancer via Kie.ai proxy.
              </p>
            </div>
          )}

          <div className="space-y-6">
            {/* Kie.ai Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-end ml-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  <ShieldCheck className="w-3 h-3" /> Kie.ai API Key
                </label>
                <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-amber-500/80 hover:text-amber-400 transition-colors uppercase tracking-wider">
                  Get Key
                </a>
              </div>
              <div className="relative group">
                <input
                  type={showKieKey ? "text" : "password"}
                  value={inputKieKey}
                  onChange={(e) => setInputKieKey(e.target.value)}
                  placeholder="Paste your Kie.ai key here"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                  autoFocus={!kieApiKey}
                />
                <button
                  type="button"
                  onClick={() => setShowKieKey(!showKieKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {showKieKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed ml-1">
                Powering Midjourney, Nano Banana, Grok Video, and ElevenLabs Voiceover pipelines.
              </p>
            </div>

            {/* Google Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-end ml-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  <ShieldCheck className="w-3 h-3" /> Google Gemini API Key
                </label>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-500/80 hover:text-blue-400 transition-colors uppercase tracking-wider">
                  Get Key
                </a>
              </div>
              <div className="relative group">
                <input
                  type={showGoogleKey ? "text" : "password"}
                  value={inputGoogleKey}
                  onChange={(e) => setInputGoogleKey(e.target.value)}
                  placeholder="Optional: For official Gemini integration"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed ml-1">
                Used for high-speed script architecting and cinematic logic.
              </p>
            </div>

          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={!inputKieKey.trim()}
              className="flex-1 bg-gradient-to-r from-zinc-100 to-zinc-300 hover:from-white hover:to-zinc-200 text-black font-bold py-4 rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {kieApiKey ? 'Update Configuration' : 'Initialize System'}
            </button>
            {kieApiKey && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-4 text-red-500 hover:text-red-400 transition-colors border border-zinc-800 rounded-2xl hover:bg-red-500/10"
                title="Clear All Data"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {!kieApiKey && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-6 py-4 text-sm font-bold text-zinc-500 hover:text-white transition-colors"
              >
                Try Demo
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  )
}

