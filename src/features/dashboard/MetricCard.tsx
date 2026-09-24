import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  testId,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sub?: string
  accent?: string
  /** 供端到端测试稳定定位（不影响可访问性）。 */
  testId?: string
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-foreground-muted">
        <Icon className="h-4 w-4" style={accent ? { color: accent } : undefined} />
        <span className="text-xs">{label}</span>
      </div>
      <p data-testid={testId ? `${testId}-value` : undefined} className="mt-2 text-[26px] font-semibold leading-none tnum text-foreground">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-foreground-muted">{sub}</p>}
    </div>
  )
}
