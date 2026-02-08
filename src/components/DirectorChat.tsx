'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { buildDirectorContext } from '@/lib/useDirectorContext'
import {
  X,
  Send,
  Camera,
  Loader2,
  Trash2,
  Sparkles,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '@/components/Toast'

// ── Action Parsing ─────────────────────────────────────────────────────
interface ParsedAction {
  type: string
  param?: string
  content: string
}

function parseActions(text: string): { segments: (string | ParsedAction)[]; raw: string } {
  const regex = /<<<ACTION:([\w_]+)(?::([^>]*?))?>>>([\s\S]*?)<<<END_ACTION>>>/g
  const segments: (string | ParsedAction)[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index))
    }
    segments.push({
      type: match[1],
      param: match[2] || undefined,
      content: match[3].trim(),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex))
  }

  // Strip action blocks from display text
  const raw = text.replace(/<<<ACTION:[\s\S]*?<<<END_ACTION>>>/g, '').trim()

  return { segments, raw }
}

function getActionLabel(action: ParsedAction): string {
  switch (action.type) {
    case 'SET_TOPIC':
      return '✨ Use as Topic'
    case 'SET_SCENE_PROMPT':
      return `🎬 Apply to Scene ${action.param}`
    case 'SET_NARRATION':
      return '🎙️ Apply Narration'
    case 'SET_MOTION':
      return `🎥 Apply Motion to Scene ${action.param}`
    case 'SET_CONCEPT':
      return '💡 Use as Concept'
    case 'ADD_SCENE':
      return '➕ Add Scene'
    case 'SET_SWAP_PROMPT':
      return `🔄 Apply Swap Prompt to Scene ${action.param}`
    default:
      return 'Apply'
  }
}

function applyAction(action: ParsedAction): { ok: boolean; msg: string } {
  const store = useAppStore.getState()

  switch (action.type) {
    case 'SET_TOPIC':
      store.setTopic(action.content)
      return { ok: true, msg: 'Topic updated' }

    case 'SET_SCENE_PROMPT': {
      const sceneId = parseInt(action.param || '0', 10)
      if (sceneId <= 0) return { ok: false, msg: 'Invalid scene ID' }
      const scene = store.architect.scenes.find((s) => s.id === sceneId)
      if (!scene) return { ok: false, msg: `Scene ${sceneId} doesn't exist yet — generate a script first` }
      store.updateScene(sceneId, { prompt: action.content })
      return { ok: true, msg: `Scene ${sceneId} prompt updated` }
    }

    case 'SET_NARRATION': {
      const currentScript = store.architect.script
      if (currentScript) {
        store.setArchitectState({
          script: { ...currentScript, narration: action.content },
        })
      } else {
        store.setArchitectState({
          script: { scene1: '', narration: action.content },
        })
      }
      return { ok: true, msg: 'Narration updated' }
    }

    case 'SET_MOTION': {
      const sceneId = parseInt(action.param || '0', 10)
      if (sceneId <= 0) return { ok: false, msg: 'Invalid scene ID' }
      const scene = store.architect.scenes.find((s) => s.id === sceneId)
      if (!scene) return { ok: false, msg: `Scene ${sceneId} doesn't exist yet — generate a script first` }
      store.updateScene(sceneId, { grokMotion: action.content })
      return { ok: true, msg: `Scene ${sceneId} motion prompt updated` }
    }

    case 'SET_CONCEPT': {
      const currentStrategy = store.architect.strategy
      if (currentStrategy) {
        store.setArchitectState({
          strategy: { ...currentStrategy, concept: action.content },
        })
      } else {
        store.setArchitectState({
          strategy: { concept: action.content, music: '', overlay: '', loopLogic: '' },
        })
      }
      return { ok: true, msg: 'Concept updated' }
    }

    case 'SET_SWAP_PROMPT': {
      // Write to the shared swapPrompt in the store — MotionStudio syncs it
      // into the Swap Instructions textarea for all character refs
      store.setSwapPrompt(action.content)
      return { ok: true, msg: 'Swap instructions updated — open MotionStudio to see them' }
    }

    case 'ADD_SCENE': {
      try {
        const sceneData = JSON.parse(action.content)
        const scenes = store.architect.scenes
        const nextId = scenes.length > 0 ? Math.max(...scenes.map((s) => s.id)) + 1 : 1
        const newScene = {
          id: nextId,
          visual: sceneData.visual || 'New scene',
          tool: (sceneData.tool || 'Midjourney') as 'Midjourney' | 'Nano Banana',
          reference: sceneData.reference || 'N/A',
          prompt: sceneData.prompt || '',
          grokMotion: sceneData.grokMotion || '',
          status: 'pending' as const,
          images: [],
        }
        store.setArchitectState({ scenes: [...scenes, newScene] })
        return { ok: true, msg: `Scene ${nextId} added with image & motion prompts` }
      } catch {
        return { ok: false, msg: 'Failed to parse scene data' }
      }
    }

    default:
      return { ok: false, msg: `Unknown action: ${action.type}` }
  }
}

// ── Message Bubble ─────────────────────────────────────────────────────
function MessageBubble({
  message,
  onActionResult,
}: {
  message: { role: 'user' | 'director'; content: string; screenshot?: string; timestamp: number }
  onActionResult: (result: { ok: boolean; msg: string }) => void
}) {
  const isUser = message.role === 'user'
  const { segments } = parseActions(message.content)
  const [appliedActions, setAppliedActions] = useState<Set<number>>(new Set())

  const handleApply = (action: ParsedAction, index: number) => {
    const result = applyAction(action)
    if (result.ok) {
      setAppliedActions((prev) => new Set(prev).add(index))
    }
    onActionResult(result)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-zinc-800 text-zinc-100 rounded-br-md'
            : 'bg-zinc-900 text-zinc-200 rounded-bl-md border-l-2 border-amber-500/40'
        }`}
      >
        {/* Screenshot thumbnail */}
        {message.screenshot && (
          <div className="mb-2">
            <img
              src={message.screenshot}
              alt="Screenshot"
              className="rounded-lg max-h-32 w-auto border border-zinc-700"
            />
          </div>
        )}

        {/* Text content */}
        {segments.map((seg, i) => {
          if (typeof seg === 'string') {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {formatMarkdown(seg)}
              </span>
            )
          }
          // Action button
          return (
            <button
              key={i}
              onClick={() => handleApply(seg, i)}
              disabled={appliedActions.has(i)}
              className={`mt-2 block w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                appliedActions.has(i)
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20 cursor-default'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer'
              }`}
            >
              {appliedActions.has(i) ? '✓ Applied' : getActionLabel(seg)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Simple markdown-like formatting for bold and inline code
function formatMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-300 text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

// ── Context Indicator ──────────────────────────────────────────────────
function ContextIndicator({ viewMode }: { viewMode: 'mosaic' | 'architect' }) {
  const architect = useAppStore((s) => s.architect)
  const images = useAppStore((s) => s.images)

  if (viewMode === 'architect') {
    return (
      <span className="text-xs text-zinc-500">
        Viewing: Architect — {architect.scenes.length} scenes
      </span>
    )
  }
  return (
    <span className="text-xs text-zinc-500">
      Viewing: Mosaic — {images.filter((i) => i.status === 'done').length} images
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────
export default function DirectorChat({ viewMode }: { viewMode: 'mosaic' | 'architect' }) {
  const { directorChat, toggleDirectorChat, addDirectorMessage, clearDirectorChat } = useAppStore()
  const { isOpen, messages } = directorChat
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleActionResult = useCallback(
    (result: { ok: boolean; msg: string }) => {
      toast({
        title: result.ok ? '✓ Applied' : 'Cannot apply',
        description: result.msg,
        variant: result.ok ? 'success' : 'warning',
      })
    },
    [toast]
  )

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleScreenshot = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        useCORS: true,
        logging: false,
        width: Math.min(document.body.scrollWidth, 1920),
        height: Math.min(document.body.scrollHeight, 1080),
      })

      // Resize to max 1024px wide
      const maxWidth = 1024
      const ratio = Math.min(maxWidth / canvas.width, 1)
      const resized = document.createElement('canvas')
      resized.width = canvas.width * ratio
      resized.height = canvas.height * ratio
      const ctx = resized.getContext('2d')
      ctx?.drawImage(canvas, 0, 0, resized.width, resized.height)

      const dataUrl = resized.toDataURL('image/jpeg', 0.6)
      setScreenshot(dataUrl)
    } catch (err) {
      console.error('Screenshot failed:', err)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text && !screenshot) return
    if (isLoading) return

    const store = useAppStore.getState()
    const apiKey = store.provider === 'google' ? store.googleApiKey : store.kieApiKey
    if (!apiKey) return

    // Add user message
    const userMsg = {
      role: 'user' as const,
      content: text || '(screenshot attached)',
      screenshot: screenshot || undefined,
    }
    addDirectorMessage(userMsg)
    setInput('')
    setScreenshot(null)
    setIsLoading(true)

    try {
      // Build context snapshot
      const context = buildDirectorContext(store, viewMode)

      // Build messages for API (include full history)
      const allMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content, screenshot: m.screenshot })),
        userMsg,
      ]

      const response = await fetch('/api/director-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          context,
          apiKey,
          provider: store.provider,
        }),
      })

      const result = await response.json()

      if (result.error) {
        addDirectorMessage({
          role: 'director',
          content: `⚠️ ${result.error}`,
        })
      } else {
        addDirectorMessage({
          role: 'director',
          content: result.content,
        })
      }
    } catch (err) {
      addDirectorMessage({
        role: 'director',
        content: '⚠️ Failed to reach Director AI. Check your connection and API key.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed top-0 right-0 h-full w-[400px] z-[60] flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Director AI</h3>
                <ContextIndicator viewMode={viewMode} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearDirectorChat}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleDirectorChat}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300 mb-1">Director AI is ready</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    I can see your workspace. Ask me to critique your prompts, suggest topics, write
                    motion descriptions, or troubleshoot generations.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full mt-2">
                  {[
                    'Review my current scenes and suggest improvements',
                    'Help me pick a viral topic',
                    'Write better motion prompts for my scenes',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion)
                        inputRef.current?.focus()
                      }}
                      className="text-left text-xs px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 hover:border-amber-500/20 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble
                key={`${msg.timestamp}-${i}`}
                message={msg}
                onActionResult={handleActionResult}
              />
            ))}

            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-zinc-900 rounded-2xl rounded-bl-md px-4 py-3 border-l-2 border-amber-500/40">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    <span className="text-xs text-zinc-400">Director is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Screenshot Preview */}
          {screenshot && (
            <div className="px-4 pb-2">
              <div className="relative inline-block">
                <img
                  src={screenshot}
                  alt="Screenshot preview"
                  className="h-16 rounded-lg border border-zinc-700"
                />
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
            <div className="flex items-end gap-2">
              <button
                onClick={handleScreenshot}
                className="p-2.5 rounded-xl text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/50 transition-all flex-shrink-0"
                title="Capture screenshot"
              >
                <Camera className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Director AI..."
                  rows={1}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 resize-none max-h-32 scrollbar-thin"
                  style={{ minHeight: '40px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !screenshot)}
                className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
