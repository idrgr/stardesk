import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Pause, RotateCcw, X, Check, Timer, Repeat, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useEpoch } from '@/app/epoch-context'
import { useToast } from '@/components/ui/Toast'
import {
  getActiveSession,
  startFocus,
  pauseFocus,
  resumeFocus,
  completeFocus,
  abandonFocus,
  getRestorePendingSession,
  confirmRestoredFocus,
  listSessions,
} from '@/data/repositories/focus'
import { queryTasks } from '@/data/repositories/tasks'
import { remainingSeconds, elapsedActiveSeconds, isExpired } from '@/domain/focus'
import { todayInTimeZone, formatDateShort } from '@/lib/date'
import type { FocusSession } from '@/domain/entities'
import { ConvertToActivityDialog } from './ConvertToActivityDialog'
import { cn } from '@/lib/cn'

const PRESETS = [25, 45, 60]

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function FocusPanel({ compact = false }: { compact?: boolean }) {
  const { db } = useData()
  const { settings } = useSettings()
  const { isStale } = useEpoch()
  const { toast } = useToast()
  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'

  const active = useLiveQuery(() => getActiveSession(db), [db])
  const restorePending = useLiveQuery(() => getRestorePendingSession(db), [db])
  const sessions = useLiveQuery(() => listSessions(db), [db]) ?? []
  const convertedIds = useLiveQuery(
    () => db.activityLogs.toArray().then((rows) => new Set(rows.map((r) => r.sourceFocusSessionId).filter(Boolean) as string[])),
    [db],
  )
  const tasks = useLiveQuery(() => queryTasks(db, { includeDone: false }), [db]) ?? []

  const [plannedMinutes, setPlannedMinutes] = useState(25)
  const [customMinutes, setCustomMinutes] = useState('')
  const [taskId, setTaskId] = useState('')
  const [confirmDate, setConfirmDate] = useState(todayInTimeZone(timeZone))
  const [tick, setTick] = useState(0)
  const [justFinished, setJustFinished] = useState<FocusSession | null>(null)
  const [convertTarget, setConvertTarget] = useState<FocusSession | null>(null)
  const [restoreSeconds, setRestoreSeconds] = useState('0')
  const [restoreDate, setRestoreDate] = useState(todayInTimeZone(timeZone))

  // 每秒刷新显示（仅用于显示，时间真实性来自时间戳）。
  // 数据空间被替换后停止计时：旧会话不再继续走表。
  useEffect(() => {
    if (isStale) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [isStale])

  // 数据被替换：清理本标签页的临时状态，避免继续操作旧会话。
  useEffect(() => {
    if (isStale) {
      setJustFinished(null)
      setConvertTarget(null)
    }
  }, [isStale])

  useEffect(() => {
    if (restorePending) {
      const fallback = Math.round(
        (restorePending.actualSeconds ?? restorePending.accumulatedActiveSeconds) / 60,
      )
      setRestoreSeconds(String(fallback))
      setRestoreDate(restorePending.localDate ?? todayInTimeZone(timeZone))
    }
  }, [restorePending?.id, timeZone])

  const nowMs = Date.now()
  const expired = active ? isExpired(active, nowMs) : false

  const remaining = useMemo(() => {
    if (!active) return 0
    if (active.status === 'paused') return Math.max(0, active.plannedSeconds - active.accumulatedActiveSeconds)
    return remainingSeconds(active, nowMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, nowMs, tick])

  const progress = active ? Math.min(1, elapsedActiveSeconds(active, nowMs) / active.plannedSeconds) : 0
  const recent = sessions.filter((s) => s.status === 'done').slice(0, 5)

  const handleStart = async () => {
    const mins = customMinutes !== '' ? Number(customMinutes) : plannedMinutes
    if (!isFinite(mins) || mins <= 0) {
      toast('请输入有效的专注时长', 'error')
      return
    }
    const selectedTask = tasks.find((t) => t.id === taskId)
    try {
      await startFocus(db, {
        plannedSeconds: Math.round(mins * 60),
        taskId: taskId || null,
        moduleId: selectedTask?.moduleId ?? null,
      })
      setConfirmDate(todayInTimeZone(timeZone))
      setJustFinished(null)
      toast('专注开始', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '启动失败', 'error')
    }
  }

  const handleConfirm = async () => {
    if (!active) return
    try {
      const done = await completeFocus(db, active.id, confirmDate)
      setJustFinished(done)
      toast('已结束专注，记录已保存', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error')
    }
  }

  const handleAbandon = async () => {
    if (!active) return
    try {
      await abandonFocus(db, active.id)
      toast('已放弃本次专注', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  const handlePauseResume = async () => {
    if (!active) return
    try {
      if (active.status === 'running') await pauseFocus(db, active.id)
      else await resumeFocus(db, active.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  const handleConfirmRestored = async () => {
    if (!restorePending) return
    const mins = Number(restoreSeconds)
    if (!isFinite(mins) || mins < 0) {
      toast('请输入有效的时长', 'error')
      return
    }
    try {
      const done = await confirmRestoredFocus(db, restorePending.id, {
        actualSeconds: Math.round(mins * 60),
        localDate: restoreDate,
      })
      setJustFinished(done)
      toast('已确认恢复的专注记录', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  const handleAbandonRestored = async () => {
    if (!restorePending) return
    try {
      await abandonFocus(db, restorePending.id)
      toast('已放弃该恢复会话', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  // 0) 恢复备份后遗留的会话：先确认实际时长或放弃，不自动继续计时。
  if (restorePending) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-warning text-warning">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">检测到恢复的专注会话</p>
        <p className="max-w-xs text-center text-xs text-foreground-muted">
          这是从备份恢复的未结束会话。请确认实际专注时长，或放弃它——它不会自动继续计时。
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">时长（分钟）</span>
          <Input
            type="number"
            min={0}
            value={restoreSeconds}
            onChange={(e) => setRestoreSeconds(e.target.value)}
            className="w-24"
            aria-label="实际专注分钟"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">统计日期</span>
          <Input
            type="date"
            value={restoreDate}
            onChange={(e) => setRestoreDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleConfirmRestored}>
            <Check className="h-4 w-4" />
            确认时长
          </Button>
          <Button variant="ghost" onClick={handleAbandonRestored}>
            <X className="h-4 w-4" />
            放弃
          </Button>
        </div>
      </div>
    )
  }

  // 1) 刚刚结束的会话：直接提供「转为领域记录」入口。
  if (!active && justFinished) {
    const minutes = Math.round((justFinished.actualSeconds ?? 0) / 60)
    const already = convertedIds?.has(justFinished.id) ?? false
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-success text-success">
          <Check className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-foreground">本次专注已记录</p>
        <p className="text-xs text-foreground-muted tnum">
          {minutes} 分钟 · {formatDateShort(justFinished.localDate ?? todayInTimeZone(timeZone))}
        </p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => setConvertTarget(justFinished)}
            disabled={already}
          >
            <Repeat className="h-4 w-4" />
            {already ? '已转为领域记录' : '转为领域记录'}
          </Button>
          <Button variant="ghost" onClick={() => setJustFinished(null)}>
            完成
          </Button>
        </div>
        <p className="max-w-xs text-center text-[11px] text-foreground-muted">
          转换只会新增一条活动记录，不会自动完成关联任务。
        </p>
        <RecentFocus
          sessions={recent}
          convertedIds={convertedIds}
          onConvert={setConvertTarget}
        />
        <ConvertToActivityDialog
          open={convertTarget != null}
          onClose={() => setConvertTarget(null)}
          session={convertTarget}
          defaultModuleId={convertTarget?.moduleId ?? null}
        />
      </div>
    )
  }

  // 2) 无活动会话：开始状态
  if (!active) {
    return (
      <div className={cn('flex flex-col items-center gap-4 py-2', compact && 'py-0')}>
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border text-accent">
          <Timer className="h-8 w-8" />
        </div>
        <div className="flex gap-1.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setPlannedMinutes(m); setCustomMinutes('') }}
              className={cn('rounded-lg border px-3 py-1.5 text-sm tnum', plannedMinutes === m && customMinutes === '' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface')}
            >
              {m}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="自定义"
            aria-label="自定义分钟"
            className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tnum text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="关联任务" className="max-w-xs">
          <option value="">不关联任务</option>
          {tasks.slice(0, 20).map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </Select>
        <Button variant="primary" onClick={handleStart}>
          <Play className="h-4 w-4" />
          开始专注
        </Button>
        <RecentFocus sessions={recent} convertedIds={convertedIds} onConvert={setConvertTarget} />
        <ConvertToActivityDialog
          open={convertTarget != null}
          onClose={() => setConvertTarget(null)}
          session={convertTarget}
          defaultModuleId={convertTarget?.moduleId ?? null}
        />
      </div>
    )
  }

  // 3) 待确认（倒计时到点）
  if (expired) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-warning text-warning">
          <span className="text-lg font-semibold tnum">00:00</span>
        </div>
        <p className="text-sm text-foreground-secondary">专注时间已到，请确认本次记录。</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">统计日期</span>
          <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleConfirm}>
            <Check className="h-4 w-4" />
            确认结束
          </Button>
          <Button variant="ghost" onClick={handleAbandon}>
            <X className="h-4 w-4" />
            放弃
          </Button>
        </div>
      </div>
    )
  }

  // 4) 运行中 / 暂停
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--sd-border)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="46" fill="none" stroke="var(--sd-accent)" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className={cn('text-2xl font-semibold tnum', active.status === 'paused' ? 'text-foreground-muted' : 'text-foreground')}>
          {fmt(remaining)}
        </span>
      </div>
      <p className="text-xs text-foreground-muted">
        {active.status === 'running' ? '专注中' : '已暂停'}
        {active.taskId && ' · 关联任务'}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={handlePauseResume}>
          {active.status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {active.status === 'running' ? '暂停' : '继续'}
        </Button>
        <Button variant="secondary" onClick={handleConfirm}>
          <Check className="h-4 w-4" />
          结束
        </Button>
        <Button variant="ghost" onClick={handleAbandon}>
          <RotateCcw className="h-4 w-4" />
          放弃
        </Button>
      </div>
    </div>
  )
}

/** 最近完成的专注，并标明是否已转为领域记录。 */
function RecentFocus({
  sessions,
  convertedIds,
  onConvert,
}: {
  sessions: FocusSession[]
  convertedIds?: Set<string>
  onConvert: (s: FocusSession) => void
}) {
  if (sessions.length === 0) return null
  return (
    <div className="mt-2 w-full border-t border-divider pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">最近专注</p>
      <ul className="flex flex-col gap-1">
        {sessions.map((s) => {
          const converted = convertedIds?.has(s.id) ?? false
          return (
            <li key={s.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate text-foreground-secondary">
                {s.localDate ? formatDateShort(s.localDate) : '—'} ·{' '}
                <span className="tnum">{Math.round((s.actualSeconds ?? 0) / 60)} 分钟</span>
              </span>
              {converted ? (
                <Badge tone="success">已转记录</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => onConvert(s)}
                  className="rounded px-1.5 py-0.5 text-accent hover:underline"
                >
                  转为领域记录
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
