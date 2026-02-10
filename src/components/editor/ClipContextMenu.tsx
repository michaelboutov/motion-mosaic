'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/lib/editorStore'
import { useToastStore } from '@/lib/toastStore'
import { Scissors, Copy, Trash2 } from 'lucide-react'

interface ClipContextMenuProps {
  clipId: string
  x: number
  y: number
  onClose: () => void
}

export default function ClipContextMenu({ clipId, x, y, onClose }: ClipContextMenuProps) {
  const { splitClip, duplicateClip, removeClip, currentTime, clips } = useEditorStore()
  const { addToast } = useToastStore()
  const menuRef = useRef<HTMLDivElement>(null)

  const clip = clips.find(c => c.id === clipId)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  if (!clip) return null

  const canSplit = currentTime > clip.startTime && currentTime < clip.startTime + clip.duration

  const items = [
    {
      label: 'Split at playhead',
      icon: Scissors,
      shortcut: 'S',
      disabled: !canSplit,
      action: () => { splitClip(clipId, currentTime); addToast('Clip split', 'info'); onClose() },
    },
    {
      label: 'Duplicate',
      icon: Copy,
      shortcut: 'D',
      action: () => { duplicateClip(clipId); addToast('Clip duplicated', 'info'); onClose() },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: Trash2,
      shortcut: '⌫',
      danger: true,
      action: () => { removeClip(clipId); addToast('Clip deleted', 'info'); onClose() },
    },
  ] as const

  // Clamp position to viewport
  const menuWidth = 200
  const menuHeight = items.length * 40
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] w-[200px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item, i) => {
        if ('divider' in item) {
          return <div key={i} className="h-px bg-zinc-800 mx-2 my-1" />
        }
        const Icon = item.icon
        return (
          <button
            key={i}
            onClick={item.action}
            disabled={'disabled' in item && item.disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              'danger' in item && item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {'shortcut' in item && (
              <kbd className="text-[9px] text-zinc-600 font-mono px-1.5 py-0.5 bg-zinc-800/50 rounded">{item.shortcut}</kbd>
            )}
          </button>
        )
      })}
    </div>
  )
}
