import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useSettings } from '@/app/settings-context'
import { lastNDays, formatDateShort, formatDuration } from '@/lib/date'
import type { ActivityLog } from '@/domain/entities'
import { cn } from '@/lib/cn'

export function TrendChart({ activities }: { activities: ActivityLog[] }) {
  const { settings } = useSettings()
  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const [days, setDays] = useState(7)

  const data = useMemo(() => {
    const dates = lastNDays(timeZone, days)
    const byDay = new Map<string, number>()
    for (const a of activities) {
      if (dates.includes(a.localDate)) {
        byDay.set(a.localDate, (byDay.get(a.localDate) ?? 0) + (a.durationMinutes ?? 0))
      }
    }
    return dates.map((d) => ({ date: d, label: formatDateShort(d), minutes: byDay.get(d) ?? 0 }))
  }, [activities, days, timeZone])

  const total = data.reduce((sum, d) => sum + d.minutes, 0)

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">投入趋势</h2>
          <p className="text-xs text-foreground-muted">过去 {days} 天共投入 {formatDuration(total)}（学习 / 兴趣 / 运动活动记录）</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={cn('rounded-md px-2.5 py-1 text-xs', days === d ? 'bg-accent/10 text-accent' : 'text-foreground-secondary hover:text-foreground')}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5DE4F5" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#5DE4F5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-divider)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--sd-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={days === 30 ? 4 : 0} />
            <YAxis tick={{ fill: 'var(--sd-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--sd-surface-raised)', border: '1px solid var(--sd-border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--sd-text-secondary)' }}
              formatter={(value) => [formatDuration(Number(value ?? 0)), '投入']}
            />
            <Area type="monotone" dataKey="minutes" stroke="#5DE4F5" strokeWidth={2} fill="url(#trendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
