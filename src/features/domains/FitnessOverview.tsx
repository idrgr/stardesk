import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Check, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { queryTasks, completeTask, reopenTask } from '@/data/repositories/tasks'
import { queryActivities } from '@/data/repositories/activities'
import { listBodyMeasurements, upsertBodyMeasurement } from '@/data/repositories/assessments'
import { todayInTimeZone, weekRange } from '@/lib/date'
import { formatDuration } from '@/lib/date'
import type { ModuleConfig, Task } from '@/domain/entities'
import { DomainHeader, DomainSection } from './shared'
import { ActivityList, totalDuration } from '@/features/activities/ActivityList'
import { ActivityFormDialog } from '@/features/activities/ActivityFormDialog'
import { cn } from '@/lib/cn'

export function FitnessOverview({ module }: { module: ModuleConfig }) {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const today = todayInTimeZone(timeZone)
  const wr = weekRange(timeZone, settings?.weekStartsOn ?? 1)

  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const workouts = useLiveQuery(() => queryActivities(db, { moduleId: module.id, kind: 'workout' }), [db, module.id]) ?? []
  const measurements = useLiveQuery(() => listBodyMeasurements(db, module.id), [db, module.id]) ?? []

  const [activityOpen, setActivityOpen] = useState(false)
  const [linkTask, setLinkTask] = useState<{ id: string } | null>(null)
  const [weight, setWeight] = useState('')

  const weekTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.moduleId === module.id && t.plannedDate && t.plannedDate >= wr.start && t.plannedDate <= wr.end && t.status !== 'cancelled',
      ),
    [tasks, module.id, wr],
  )
  const weekWorkouts = workouts.filter((a) => a.localDate >= wr.start && a.localDate <= wr.end)

  const toggleTask = async (t: Task) => {
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

  const recordWorkoutForTask = (t: Task) => {
    setLinkTask({ id: t.id })
    setActivityOpen(true)
  }

  const saveWeight = async () => {
    const w = Number(weight)
    if (!isFinite(w) || w <= 0) {
      toast('请输入大于 0 的体重', 'error')
      return
    }
    try {
      await upsertBodyMeasurement(db, { moduleId: module.id, localDate: today, weightKg: w })
      setWeight('')
      toast('体重已记录', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DomainHeader
        module={module}
        action={
          <Button variant="primary" size="sm" onClick={() => { setLinkTask(null); setActivityOpen(true) }}>
            <Plus className="h-4 w-4" />
            记录训练
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="本周训练次数" value={String(weekWorkouts.length)} />
        <Stat label="本周训练时长" value={formatDuration(totalDuration(weekWorkouts))} />
        <Stat label="本周训练计划" value={`${weekTasks.filter((t) => t.status === 'done').length}/${weekTasks.length}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DomainSection title="本周训练计划">
          {weekTasks.length === 0 ? (
            <p className="text-sm text-foreground-muted">本周还没有训练安排。用任务安排训练，完成时记录实际运动。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {weekTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleTask(t)}
                    aria-label={t.status === 'done' ? '取消完成' : '完成'}
                    className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground-muted/50', t.status === 'done' && 'border-success bg-success')}
                  >
                    {t.status === 'done' && <Check className="h-3 w-3 text-accent-foreground" strokeWidth={3} />}
                  </button>
                  <span className={cn('flex-1 truncate text-sm text-foreground', t.status === 'done' && 'line-through opacity-60')}>{t.title}</span>
                  {t.status !== 'done' && (
                    <Button variant="ghost" size="sm" onClick={() => recordWorkoutForTask(t)}>
                      记录完成
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DomainSection>

        <DomainSection title="最近训练记录">
          <ActivityList activities={workouts.slice(0, 8)} emptyText="还没有训练记录。完成一次训练后，在这里留下记录。" />
        </DomainSection>
      </div>

      <DomainSection title="体重记录（可选）">
        <div className="mb-3 flex items-center gap-2">
          <Input type="number" step="0.1" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="体重 kg" className="w-40" />
          <Button size="sm" onClick={saveWeight}>记录今天</Button>
        </div>
        {measurements.length === 0 ? (
          <p className="text-sm text-foreground-muted">还没有体重记录。体重是可选信息，不强制填写。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {measurements.slice(-10).reverse().map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground">
                <Scale className="h-3.5 w-3.5 text-foreground-muted" />
                <span className="tnum">{m.weightKg ?? '—'} kg</span>
                <span className="text-[11px] text-foreground-muted">{m.localDate.slice(5)}</span>
              </span>
            ))}
          </div>
        )}
      </DomainSection>

      <ActivityFormDialog open={activityOpen} onClose={() => setActivityOpen(false)} module={module} linkTask={linkTask} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tnum text-foreground">{value}</p>
    </div>
  )
}
