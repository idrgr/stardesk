import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ArrowLeft, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { getModule } from '@/data/repositories/modules'
import { queryTasks, completeTask, reopenTask, softDeleteTasks } from '@/data/repositories/tasks'
import { getColor, getIcon } from '@/modules/registry'
import { todayInTimeZone } from '@/lib/date'
import { TaskItem } from '@/features/actions/TaskItem'
import { TaskFormDialog } from '@/features/actions/TaskFormDialog'
import { DomainOverview } from '@/features/domains/DomainOverview'
import type { Task } from '@/domain/entities'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const navigate = useNavigate()
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const today = todayInTimeZone(timeZone)

  const module = useLiveQuery(() => getModule(db, moduleId ?? ''), [db, moduleId])
  const tasks = useLiveQuery(() => queryTasks(db, { moduleId: moduleId ?? null }), [db, moduleId]) ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const active = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled'),
    [tasks],
  )

  if (moduleId && module === undefined) {
    return (
      <div className="flex justify-center py-16 text-sm text-foreground-muted">加载中…</div>
    )
  }

  if (moduleId && module === null) {
    return (
      <EmptyState
        icon={Inbox}
        title="领域不存在"
        description="它可能已被删除或停用。"
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            返回总览
          </Button>
        }
      />
    )
  }

  if (!module) return null

  // 内置领域使用专属概览；自定义普通模块使用通用视图。
  const isBuiltin = ['growth', 'career', 'hobbies', 'fitness'].includes(module.definitionKey)
  if (isBuiltin) {
    return <DomainOverview module={module} />
  }

  const Icon = getIcon(module.iconKey)
  const color = getColor(module.colorKey)

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

  const handleDelete = async (t: Task) => {
    try {
      await softDeleteTasks(db, [t.id])
      toast('已移入回收站', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{module.name}</h1>
            {module.description && (
              <p className="text-sm text-foreground-muted">{module.description}</p>
            )}
          </div>
        </div>
        <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增任务
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground-secondary">
          任务（{active.length} 项待办）
        </h2>
        {tasks.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={`还没有 ${module.name} 相关任务`}
            description="从这里新增第一个任务，把它纳入这个领域。"
            action={
              <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4" />
                新增任务
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                onToggleComplete={toggleComplete}
                onEdit={(task) => { setEditing(task); setFormOpen(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        task={editing}
        defaultModuleId={module.id}
      />
    </div>
  )
}
