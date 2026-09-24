import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="加载中"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted/30 border-t-foreground-muted',
        className,
      )}
    />
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground-muted">
      {children}
    </kbd>
  )
}
