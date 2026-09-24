import { Check, Trash2, Pencil, Calendar, Tag, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Task } from '@/domain/entities'
import { TASK_PRIORITY_LABEL } from '@/domain/enums'
import { isTaskOverdue } from '@/domain/rules'
import { formatDateShort } from '@/lib/date'
import { cn } from '@/lib/cn'

export function TaskItem({
  task,
  today,
  moduleName,
  onToggleComplete,
  onEdit,
  onDelete,
  selectable,
  selected,
  onSelectChange,
}: {
  task: Task
  today: string
  moduleName?: string
  onToggleComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (task: Task, selected: boolean) => void
}) {
  const done = task.status === 'done'
  const cancelled = task.status === 'cancelled'
  const overdue = isTaskOverdue(task, today)

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 transition-colors hover:border-foreground-secondary/40',
        done && 'opacity-60',
        selected && 'border-accent',
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => onSelectChange?.(task, e.target.checked)}
          aria-label={`选择 ${task.title}`}
          className="mt-1 h-4 w-4 shrink-0 accent-[#5DE4F5]"
        />
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? '标记为未完成' : '标记为完成'}
        onClick={() => onToggleComplete(task)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          done
            ? 'border-success bg-success text-accent-foreground'
            : 'border-foreground-muted/50 hover:border-accent hover:text-accent',
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={cn(
            'block w-full text-left text-sm font-medium text-foreground hover:text-accent',
            (done || cancelled) && 'line-through',
            cancelled && 'text-foreground-muted',
          )}
        >
          {task.title}
        </button>

        {(moduleName || task.tags.length > 0 || task.plannedDate || task.dueDate || task.estimatedMinutes != null) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
            {moduleName && <span>{moduleName}</span>}
            {task.plannedDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateShort(task.plannedDate)}
              </span>
            )}
            {task.dueDate && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'text-warning')}>
                <Clock className="h-3 w-3" />
                {formatDateShort(task.dueDate)} 截止
                {overdue && ' · 已逾期'}
              </span>
            )}
            {task.estimatedMinutes != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimatedMinutes} 分钟
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {task.priority !== 'medium' && (
          <Badge tone={task.priority === 'high' ? 'danger' : 'neutral'} className="mr-1">
            {TASK_PRIORITY_LABEL[task.priority]}
          </Badge>
        )}
        {/* 可访问名称带上任务标题：列表里每个「编辑/删除」按钮否则无法区分。 */}
        <Button variant="ghost" size="icon" onClick={() => onEdit(task)} aria-label={`编辑任务：${task.title}`} className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task)}
          aria-label={`删除任务：${task.title}`}
          className="h-7 w-7 text-foreground-muted hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
