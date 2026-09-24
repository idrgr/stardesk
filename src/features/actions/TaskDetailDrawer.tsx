import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, RotateCcw, Pencil, Trash2, CalendarDays, Clock, Tag } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useData } from '@/app/data-context'
import { listEnabledModules } from '@/data/repositories/modules'
import { listProjects } from '@/data/repositories/projects'
import { listGoals } from '@/data/repositories/goals'
import { queryTasks } from '@/data/repositories/tasks'
import { TASK_STATUS_LABEL, TASK_PRIORITY_LABEL } from '@/domain/enums'
import { formatDateShort } from '@/lib/date'
import type { Task } from '@/domain/entities'

export function TaskDetailDrawer({
  task,
  open,
  onClose,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
  onToggleComplete: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const { db } = useData()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const allTasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []

  const names = useMemo(
    () => ({
      modules: new Map(modules.map((m) => [m.id, m.name])),
      projects: new Map(projects.map((p) => [p.id, p.title])),
      goals: new Map(goals.map((g) => [g.id, g.title])),
    }),
    [modules, projects, goals],
  )

  const subtasks = useMemo(
    () => (task ? allTasks.filter((t) => t.parentTaskId === task.id) : []),
    [allTasks, task],
  )

  if (!task) return null
  const done = task.status === 'done'

  const rows: { label: string; value: string }[] = []
  if (task.moduleId && names.modules.get(task.moduleId)) rows.push({ label: '领域', value: names.modules.get(task.moduleId)! })
  if (task.projectId && names.projects.get(task.projectId)) rows.push({ label: '项目', value: names.projects.get(task.projectId)! })
  if (task.goalId && names.goals.get(task.goalId)) rows.push({ label: '目标', value: names.goals.get(task.goalId)! })
  if (task.plannedDate) rows.push({ label: '计划日期', value: formatDateShort(task.plannedDate) })
  if (task.scheduledTime) rows.push({ label: '具体时间', value: task.scheduledTime })
  if (task.dueDate) rows.push({ label: '截止日期', value: formatDateShort(task.dueDate) })
  if (task.estimatedMinutes != null) rows.push({ label: '预计时长', value: `${task.estimatedMinutes} 分钟` })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="任务详情"
      footer={
        <>
          <Button variant={done ? 'secondary' : 'primary'} size="sm" onClick={() => onToggleComplete(task)}>
            {done ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {done ? '重新打开' : '完成'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" />
            编辑
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(task)}>
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium leading-snug text-foreground">{task.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={done ? 'success' : 'accent'}>{TASK_STATUS_LABEL[task.status]}</Badge>
            <Badge tone={task.priority === 'high' ? 'danger' : task.priority === 'low' ? 'neutral' : 'default'}>
              {TASK_PRIORITY_LABEL[task.priority]}优先级
            </Badge>
          </div>
        </div>

        {task.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">{task.description}</p>
        )}

        {rows.length > 0 && (
          <dl className="divide-y divide-divider rounded-lg border border-border">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="text-xs text-foreground-muted">{r.label}</dt>
                <dd className="text-sm text-foreground tnum">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {task.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-foreground-muted" />
            {task.tags.map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        )}

        {subtasks.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-foreground-secondary">子任务（{subtasks.length}）</p>
            <div className="flex flex-col gap-1.5">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className={s.status === 'done' ? 'text-success' : 'text-foreground-muted'}>
                    {s.status === 'done' ? <Check className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                  </span>
                  <span className={s.status === 'done' ? 'line-through text-foreground-muted' : 'text-foreground'}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.completedAt && (
          <p className="inline-flex items-center gap-1 text-xs text-foreground-muted">
            <Clock className="h-3 w-3" />
            完成于 {task.completedLocalDate ? formatDateShort(task.completedLocalDate) : '—'}
          </p>
        )}
      </div>
    </Drawer>
  )
}
