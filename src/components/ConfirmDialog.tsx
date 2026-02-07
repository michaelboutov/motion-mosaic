'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  variant?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-xl ${variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
              <AlertTriangle className={`w-5 h-5 ${variant === 'danger' ? 'text-red-500' : 'text-amber-500'}`} />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-white font-bold text-lg">{title}</Dialog.Title>
              <Dialog.Description className="text-zinc-400 text-sm mt-1">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="text-zinc-500 hover:text-white transition-colors p-1">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">
              {cancelLabel}
            </Dialog.Close>
            <button
              onClick={() => { onConfirm(); onOpenChange(false) }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
