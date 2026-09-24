import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_CLASS: Record<Tone, string> = {
  default: 'bg-surface-raised text-foreground-secondary border-border',
  accent: 'bg-accent/10 text-accent border-accent/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  neutral: 'bg-foreground-muted/10 text-foreground-secondary border-foreground-muted/20',
}

export function Badge({
  tone = 'default',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium leading-none',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
