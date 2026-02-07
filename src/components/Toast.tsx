'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'

type ToastVariant = 'default' | 'success' | 'error' | 'warning'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-zinc-900 border-zinc-700 text-white',
  success: 'bg-zinc-900 border-emerald-500/50 text-white',
  error: 'bg-zinc-900 border-red-500/50 text-white',
  warning: 'bg-zinc-900 border-amber-500/50 text-white',
}

const variantDot: Record<ToastVariant, string> = {
  default: 'bg-zinc-400',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const toast = useCallback(
    ({ title, description, variant = 'default' }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = `toast-${++counterRef.current}`
      setToasts((prev) => [...prev, { id, title, description, variant }])
    },
    []
  )

  const handleOpenChange = useCallback((id: string, open: boolean) => {
    if (!open) {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            open
            onOpenChange={(open) => handleOpenChange(t.id, open)}
            className={`rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md flex items-start gap-3 animate-in slide-in-from-right-full fade-in duration-300 ${variantStyles[t.variant]}`}
          >
            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${variantDot[t.variant]}`} />
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-zinc-400 mt-0.5">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="text-zinc-500 hover:text-white transition-colors shrink-0">
              <X className="w-4 h-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        <ToastPrimitive.Viewport className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
