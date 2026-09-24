import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  message: string
  tone: Tone
}

interface ToastContextValue {
  toast: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = ++seq
      setItems((list) => [...list, { id, message, tone }])
      setTimeout(() => dismiss(id), 3200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-center gap-2 rounded-lg border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground shadow-lg',
                t.tone === 'success' && 'border-success/40',
                t.tone === 'error' && 'border-danger/40',
                t.tone === 'warning' && 'border-warning/40',
                t.tone === 'info' && 'border-border',
              )}
            >
              {t.tone === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
              {t.tone === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-danger" />}
              {t.tone === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="关闭提示"
                className="rounded p-0.5 text-foreground-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}
