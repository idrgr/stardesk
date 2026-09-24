import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  ListChecks,
  Check,
  Calendar,
  ArrowRight,
  Sparkles,
  Inbox,
  Star,
  Repeat,
  Target,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { queryTasks, completeTask, reopenTask } from '@/data/repositories/tasks'
import { listEnabledModules } from '@/data/repositories/modules'
import { listGoals } from '@/data/repositories/goals'
import { listHabits } from '@/data/repositories/habits'
import { queryActivities } from '@/data/repositories/activities'
import { listCompletedSessions } from '@/data/repositories/focus'
import { getDailyPlan, setTopTask, unsetTopTask, resolveDailyPlanOrder } from '@/data/repositories/dailyplan'
import { isScheduledOn } from '@/domain/habits'
import { getColor, getIcon } from '@/modules/registry'
import { todayInTimeZone, weekdayLabel, formatDateFullZh, weekRange, formatDuration } from '@/lib/date'
import type { Task } from '@/domain/entities'
import { MetricCard } from './MetricCard'
import { TaskFormDialog } from '../actions/TaskFormDialog'
import { ActivityList } from '../activities/ActivityList'
import { TrendChart } from './TrendChart'
import { cn } from '@/lib/cn'

function greetingForHour(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function hourInTimeZone(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).formatToParts(new Date())
    return Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  } catch {
    return new Date().getHours()
  }
}

export function DashboardPage() {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const today = todayInTimeZone(timeZone)
  const hour = hourInTimeZone(timeZone)
  const greeting = greetingForHour(hour)
  const nickname = settings?.nickname?.trim()

  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const habits = useLiveQuery(() => listHabits(db), [db]) ?? []
  const checkins = useLiveQuery(() => db.habitCheckins.toArray(), [db]) ?? []
  const activities = useLiveQuery(() => queryActivities(db), [db]) ?? []
  const focusSessions = useLiveQuery(() => listCompletedSessions(db), [db]) ?? []
  const plan = useLiveQuery(() => getDailyPlan(db, today), [db, today])

  const [formOpen, setFormOpen] = useState(false)

  // 今日习惯：今天应打卡数 / 已打卡数。
  const habitScheduledToday = habits.filter((h) => isScheduledOn(h, today))
  const habitDoneToday = habitScheduledToday.filter((h) => checkins.some((c) => c.habitId === h.id && c.localDate === today))
  const inProgressGoals = goals.filter((g) => g.status === 'in_progress' && !g.deletedAt)

  // 本周专注时长（仅统计有效完成的 FocusSession）。
  const focusWeek = weekRange(timeZone, settings?.weekStartsOn ?? 1)
  const weekFocusMinutes = Math.round(
    focusSessions
      .filter((s) => s.localDate && s.localDate >= focusWeek.start && s.localDate <= focusWeek.end)
      .reduce((sum, s) => sum + (s.actualSeconds ?? 0), 0) / 60,
  )

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.plannedDate === today && t.status !== 'cancelled'),
    [tasks, today],
  )

  const orderedToday = useMemo(() => resolveDailyPlanOrder(plan, todayTasks), [plan, todayTasks])
  const topIds = useMemo(() => new Set(plan?.topTaskIds ?? []), [plan])
  const topTasks = orderedToday.filter((t) => topIds.has(t.id))
  const otherTasks = orderedToday.filter((t) => !topIds.has(t.id))

  const doneCount = todayTasks.filter((t) => t.status === 'done').length
  const totalCount = todayTasks.length

  const rhythm = useMemo(
    () =>
      orderedToday
        .filter((t) => t.status !== 'done')
        .sort((a, b) => {
          if (a.scheduledTime && b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1
          if (a.scheduledTime) return -1
          if (b.scheduledTime) return 1
          return 0
        }),
    [orderedToday],
  )

  const toggleComplete = async (t: Task) => {
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

  const togglePin = async (t: Task) => {
    try {
      if (topIds.has(t.id)) {
        await unsetTopTask(db, today, t.id)
      } else {
        const ok = await setTopTask(db, today, t.id)
        if (!ok) toast('今日重点最多三项，请先取消一个', 'warning')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 问候 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-foreground">
            {greeting}{nickname ? `，${nickname}` : ''}
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {formatDateFullZh(today)} · {weekdayLabel(today)}
          </p>
        </div>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          快速新增
        </Button>
      </div>

      {/* 指标 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={ListChecks}
          label="今日计划"
          value={totalCount === 0 ? '尚未安排' : `${doneCount} / ${totalCount}`}
          sub={totalCount === 0 ? '安排今天的任务' : '计划完成 / 总数'}
          accent="#5DE4F5"
          testId="metric-today-plan"
        />
        <MetricCard
          icon={Timer}
          label="本周专注"
          value={formatDuration(weekFocusMinutes)}
          sub="已完成的专注时长"
          accent="#5DE4F5"
          testId="metric-week-focus"
        />
        <MetricCard
          icon={Repeat}
          label="今日习惯"
          value={habitScheduledToday.length === 0 ? '今日无安排' : `${habitDoneToday.length} / ${habitScheduledToday.length}`}
          sub={habitScheduledToday.length === 0 ? '暂无习惯计划' : '已完成 / 应打卡'}
          accent="#5BD6A0"
          testId="metric-today-habit"
        />
        <MetricCard
          icon={Target}
          label="进行中目标"
          value={String(inProgressGoals.length)}
          sub="当前进行中的目标"
          accent="#8C9BFF"
          testId="metric-goals"
        />
      </div>

      {/* 今日航线 + 今日节奏 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TodayRoute
            topTasks={topTasks}
            otherTasks={otherTasks}
            onToggle={toggleComplete}
            onPin={togglePin}
            onAdd={() => setFormOpen(true)}
            onViewAll={() => navigate('/actions?tab=tasks')}
          />
        </div>
        <div>
          <TodayRhythm tasks={rhythm} onToggle={toggleComplete} />
        </div>
      </div>

      {/* 领域概览 */}
      <DomainCards modules={modules} tasks={tasks} />

      {/* 趋势 + 最近活动 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TrendChart activities={activities} />
        </div>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-foreground">最近活动</h2>
          <ActivityList activities={activities.slice(0, 6)} emptyText="还没有活动记录。" />
        </section>
      </div>

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}

function TaskRow({ task, pinned, onToggle, onPin }: { task: Task; pinned: boolean; onToggle: (t: Task) => void; onPin: (t: Task) => void }) {
  const done = task.status === 'done'
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-accent/40">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => onToggle(task)}
        aria-label={done ? '标记为未完成' : '标记为完成'}
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground-muted/50 hover:border-accent', done && 'border-success bg-success')}
      >
        <Check className={cn('h-3 w-3', done ? 'text-accent-foreground' : 'text-transparent')} strokeWidth={3} />
      </button>
      <span className={cn('flex-1 truncate text-sm text-foreground', done && 'line-through opacity-60')}>{task.title}</span>
      {task.estimatedMinutes != null && <span className="text-[11px] text-foreground-muted">{task.estimatedMinutes} 分钟</span>}
      <button
        type="button"
        onClick={() => onPin(task)}
        aria-label={pinned ? '取消重点' : '设为今日重点'}
        className={cn('rounded p-1 transition-colors', pinned ? 'text-warning' : 'text-foreground-muted opacity-0 hover:text-foreground group-hover:opacity-100')}
      >
        <Star className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
      </button>
    </div>
  )
}

function TodayRoute({
  topTasks,
  otherTasks,
  onToggle,
  onPin,
  onAdd,
  onViewAll,
}: {
  topTasks: Task[]
  otherTasks: Task[]
  onToggle: (t: Task) => void
  onPin: (t: Task) => void
  onAdd: () => void
  onViewAll: () => void
}) {
  const total = topTasks.length + otherTasks.length
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold text-foreground">今日航线</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          全部任务
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="还没有安排今天的重点"
          description="把最重要的事安排到今天，早上打开就能知道从哪开始。"
          className="mt-4 border-0"
          action={
            <Button variant="primary" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              安排一个任务
            </Button>
          }
        />
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {topTasks.length > 0 && (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted">今日重点</p>
              {topTasks.map((t) => (
                <TaskRow key={t.id} task={t} pinned onToggle={onToggle} onPin={onPin} />
              ))}
            </>
          )}
          {otherTasks.length > 0 && (
            <>
              {topTasks.length > 0 && <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">其他任务</p>}
              {otherTasks.map((t) => (
                <TaskRow key={t.id} task={t} pinned={false} onToggle={onToggle} onPin={onPin} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function TodayRhythm({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task) => void }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent-secondary" />
        <h2 className="text-base font-semibold text-foreground">今日节奏</h2>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-6 text-sm text-foreground-muted">今天没有待办，可以安心做自己的事。</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  onClick={() => onToggle(t)}
                  aria-label={`完成 ${t.title}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-foreground-muted/50 text-transparent hover:border-accent"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </button>
                <span className="mt-1 w-px flex-1 bg-divider" />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-sm text-foreground">{t.title}</p>
                <p className="text-[11px] text-foreground-muted tnum">{t.scheduledTime ?? '未设定时间'}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DomainCards({ modules, tasks }: { modules: Awaited<ReturnType<typeof listEnabledModules>>; tasks: Task[] }) {
  const navigate = useNavigate()
  if (modules.length === 0) return null
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {modules.map((m) => {
        const Icon = getIcon(m.iconKey)
        const color = getColor(m.colorKey)
        const moduleTasks = tasks.filter((t) => t.moduleId === m.id && !t.deletedAt)
        const active = moduleTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
        const next = active[0]
        return (
          <button key={m.id} type="button" onClick={() => navigate(`/modules/${m.id}`)} className="group rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-foreground-secondary/40">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}22` }}>
                <Icon className="h-[18px] w-[18px]" style={{ color }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                <p className="text-[11px] text-foreground-muted tnum">{active.length} 项待办</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-foreground-secondary">
              <ArrowRight className="h-3.5 w-3.5 text-foreground-muted transition-transform group-hover:translate-x-0.5" />
              <span className="truncate">{next ? next.title : '暂无待办'}</span>
            </div>
          </button>
        )
      })}
    </section>
  )
}
