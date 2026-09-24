import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Clock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { queryTasks, completeTask, reopenTask } from '@/data/repositories/tasks'
import { listEnabledModules } from '@/data/repositories/modules'
import { todayInTimeZone, addDaysToDate, startOfWeekDate, weekdayLabel, formatDateShort } from '@/lib/date'
import type { Task } from '@/domain/entities'
import { TaskFormDialog } from './TaskFormDialog'
import { cn } from '@/lib/cn'

export function ScheduleView() {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const weekStartsOn = settings?.weekStartsOn ?? 1
  const today = todayInTimeZone(timeZone)
  const weekStart = startOfWeekDate(today, weekStartsOn)

  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])

  const [selected, setSelected] = useState(today)
  const [formOpen, setFormOpen] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDaysToDate(weekStart, i)), [weekStart])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.plannedDate || t.status === 'cancelled') continue
      const list = map.get(t.plannedDate) ?? []
      list.push(t)
      map.set(t.plannedDate, list)
    }
    return map
  }, [tasks])

  const selectedTasks = useMemo(() => {
    const list = tasksByDay.get(selected) ?? []
    return list
      .slice()
      .sort((a, b) => {
        const aAllDay = !a.scheduledTime
        const bAllDay = !b.scheduledTime
        if (aAllDay && !bAllDay) return -1
        if (!aAllDay && bAllDay) return 1
        if (a.scheduledTime && b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1
        return a.createdAt < b.createdAt ? -1 : 1
      })
  }, [tasksByDay, selected])

  const toggle = async (t: Task) => {
    try {
      if (t.status === 'done') await reopenTask(db, t.id)
      else {
        await completeTask(db, t.id, timeZone)
        toast('已完成', 'success')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">
          {formatDateShort(weekStart)} – {formatDateShort(addDaysToDate(weekStart, 6))}
        </p>
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          新增任务
        </Button>
      </div>

      {/* 周视图：7 天 */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const count = (tasksByDay.get(d) ?? []).filter((t) => t.status !== 'done').length
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={selected === d}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors',
                selected === d
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-foreground-secondary hover:bg-surface',
                d === today && 'border-accent/40',
              )}
            >
              <span className="text-[11px]">{weekdayLabel(d)}</span>
              <span className="text-sm font-medium tnum">{formatDateShort(d)}</span>
              {count > 0 && <span className="text-[10px] text-foreground-muted">{count} 项</span>}
            </button>
          )
        })}
      </div>

      {/* 日列表 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground-secondary">
          {weekdayLabel(selected)} {formatDateShort(selected)}
        </h3>
        {selectedTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-muted">这一天还没有安排任务。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedTasks.map((t) => {
              const done = t.status === 'done'
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/40"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-foreground-muted/50',
                      done && 'border-success bg-success',
                    )}
                  />
                  <span className={cn('flex-1 truncate text-sm text-foreground', done && 'line-through opacity-60')}>
                    {t.title}
                  </span>
                  {t.scheduledTime ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted tnum">
                      <Clock className="h-3 w-3" />
                      {t.scheduledTime}
                    </span>
                  ) : (
                    <span className="text-[11px] text-foreground-muted">全天</span>
                  )}
                  {t.moduleId && moduleNames.get(t.moduleId) && (
                    <span className="text-[11px] text-foreground-muted">{moduleNames.get(t.moduleId)}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} defaultModuleId={undefined} />
    </div>
  )
}
