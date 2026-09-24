import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Repeat, Pencil, Pause, Play, Flame, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { listHabits, toggleCheckin, pauseHabit, resumeHabit } from '@/data/repositories/habits'
import { listEnabledModules } from '@/data/repositories/modules'
import { computeStreak, computeWeekStats, isScheduledOn } from '@/domain/habits'
import { todayInTimeZone, addDaysToDate, weekRange } from '@/lib/date'
import type { Habit } from '@/domain/entities'
import { HabitFormDialog } from './HabitFormDialog'
import { cn } from '@/lib/cn'

export function HabitsView() {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const weekStartsOn = settings?.weekStartsOn ?? 1
  const today = todayInTimeZone(timeZone)
  const wr = weekRange(timeZone, weekStartsOn)

  const habits = useLiveQuery(() => listHabits(db), [db]) ?? []
  const checkins = useLiveQuery(() => db.habitCheckins.toArray(), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])

  const checkinsByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of checkins) {
      let set = map.get(c.habitId)
      if (!set) {
        set = new Set()
        map.set(c.habitId, set)
      }
      set.add(c.localDate)
    }
    return map
  }, [checkins])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)

  const handleToggle = async (h: Habit) => {
    try {
      const checked = await toggleCheckin(db, h.id, today, today)
      toast(checked ? '已打卡' : '已取消打卡', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  const handlePause = async (h: Habit) => {
    await pauseHabit(db, h.id, today)
  }
  const handleResume = async (h: Habit) => {
    await resumeHabit(db, h.id, today)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{habits.length} 个习惯</p>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增习惯
        </Button>
      </div>

      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="还没有习惯"
          description="每天或每周重复的小事，打卡一次就是一次积累。"
          action={
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />
              新增习惯
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {habits.map((h) => {
            const dates = checkinsByHabit.get(h.id) ?? new Set<string>()
            const scheduledToday = isScheduledOn(h, today)
            const checkedToday = dates.has(today)
            const streak = computeStreak(h, dates, today)
            const week = computeWeekStats(h, dates, wr.start, today, wr.end)
            const paused = h.pauseIntervals.some((p) => p.end == null)

            return (
              <div key={h.id} className="group rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => { setEditing(h); setFormOpen(true) }}
                      className="block w-full text-left text-sm font-medium text-foreground hover:text-accent"
                    >
                      {h.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                      {moduleNames.get(h.moduleId) && <span>{moduleNames.get(h.moduleId)}</span>}
                      {paused && <Badge tone="warning">已暂停</Badge>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(h)}
                    disabled={!scheduledToday || paused}
                    aria-pressed={checkedToday}
                    aria-label={checkedToday ? '取消打卡' : '打卡'}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40',
                      checkedToday
                        ? 'border-success bg-success text-accent-foreground'
                        : 'border-foreground-muted/50 text-transparent hover:border-accent hover:text-accent',
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>

                {/* 最近 7 天 */}
                <div className="mt-3 flex items-center gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = addDaysToDate(today, -(6 - i))
                    const checked = dates.has(d)
                    return (
                      <span
                        key={d}
                        title={d}
                        className={cn(
                          'h-2.5 flex-1 rounded-full',
                          checked ? 'bg-accent' : 'bg-surface-raised',
                        )}
                      />
                    )
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
                  <span className="inline-flex items-center gap-1">
                    <Flame className="h-3 w-3 text-warning" />
                    连续 {streak} 天
                  </span>
                  <span>
                    本周{' '}
                    {week.rate == null ? '暂无安排' : `${week.completed}/${week.opportunities}`}
                  </span>
                  <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => (paused ? handleResume(h) : handlePause(h))}
                      aria-label={paused ? '恢复' : '暂停'}
                      className="rounded p-1 text-foreground-muted hover:text-foreground"
                    >
                      {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(h); setFormOpen(true) }}
                      aria-label="编辑习惯"
                      className="rounded p-1 text-foreground-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <HabitFormDialog open={formOpen} onClose={() => setFormOpen(false)} habit={editing} />
    </div>
  )
}
