import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { queryTasks, completeTask, reopenTask, softDeleteTasks, archiveTasks, rescheduleTasks } from '@/data/repositories/tasks'
import { listEnabledModules } from '@/data/repositories/modules'
import { isTaskOverdue } from '@/domain/rules'
import { todayInTimeZone, addDaysToDate } from '@/lib/date'
import type { Task } from '@/domain/entities'
import type { TaskPriority, TaskStatus } from '@/domain/enums'
import { TaskItem } from './TaskItem'
import { TaskFormDialog } from './TaskFormDialog'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { cn } from '@/lib/cn'

type View = 'all' | 'today' | 'week' | 'overdue' | 'done'

const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '未来 7 天' },
  { key: 'overdue', label: '逾期' },
  { key: 'done', label: '已完成' },
]

export function TasksView() {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const today = todayInTimeZone(timeZone)

  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])

  const [view, setView] = useState<View>('all')
  const [status, setStatus] = useState<'all' | TaskStatus>('all')
  const [priority, setPriority] = useState<'all' | TaskPriority>('all')
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)

  const detailTask = detailId ? (tasks.find((t) => t.id === detailId) ?? null) : null

  useEffect(() => {
    setKeyword(searchParams.get('q') ?? '')
  }, [searchParams])

  const filtered = useMemo(() => {
    let list = tasks
    if (view === 'today') list = list.filter((t) => t.plannedDate === today)
    else if (view === 'week')
      list = list.filter(
        (t) => t.plannedDate && t.plannedDate >= today && t.plannedDate <= addDaysToDate(today, 7),
      )
    else if (view === 'overdue') list = list.filter((t) => isTaskOverdue(t, today))
    else if (view === 'done') list = list.filter((t) => t.status === 'done')

    if (status !== 'all') list = list.filter((t) => t.status === status)
    if (priority !== 'all') list = list.filter((t) => t.priority === priority)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw) ||
          t.tags.some((tag) => tag.toLowerCase().includes(kw)),
      )
    }
    return list
  }, [tasks, view, status, priority, keyword, today])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openDetail = (t: Task) => setDetailId(t.id)
  const openEdit = (t: Task) => {
    setEditing(t)
    setFormOpen(true)
  }

  const toggleComplete = async (t: Task) => {
    try {
      if (t.status === 'done') {
        await reopenTask(db, t.id)
        toast('已重新打开', 'info')
      } else {
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

  const toggleSelect = (t: Task, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(t.id)
      else next.delete(t.id)
      return next
    })
  }

  const selectedTasks = filtered.filter((t) => selected.has(t.id))

  const batchComplete = async () => {
    for (const id of selected) {
      const t = tasks.find((x) => x.id === id)
      if (t && t.status !== 'done') await completeTask(db, id, timeZone)
    }
    toast(`已完成 ${selected.size} 项`, 'success')
    clearSelection()
  }

  const batchArchive = async () => {
    const n = await archiveTasks(db, [...selected])
    toast(`已归档 ${n} 项`, 'info')
    clearSelection()
  }

  const batchDelete = async () => {
    const n = await softDeleteTasks(db, [...selected])
    toast(`已移入回收站 ${n} 项`, 'info')
    clearSelection()
  }

  const batchReschedule = async (date: string | null) => {
    const n = await rescheduleTasks(db, [...selected], date)
    toast(date ? `已改期 ${n} 项` : `已移除计划日期 ${n} 项`, 'info')
    clearSelection()
  }

  const clearSelection = () => {
    setSelected(new Set())
    setSelectMode(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{filtered.length} 项任务</p>
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectMode((s) => !s)
              setSelected(new Set())
            }}
          >
            {selectMode ? '取消选择' : '批量选择'}
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增任务
          </Button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectMode && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-xs text-foreground-secondary">已选 {selected.size} 项</span>
          <Button size="sm" onClick={batchComplete}>完成</Button>
          <Input
            type="date"
            className="h-8 w-36"
            aria-label="批量改期到"
            onChange={(e) => e.target.value && batchReschedule(e.target.value)}
          />
          <Button size="sm" variant="secondary" onClick={() => batchReschedule(null)}>移除日期</Button>
          <Button size="sm" variant="secondary" onClick={batchArchive}>归档</Button>
          <Button size="sm" variant="danger" onClick={batchDelete}>删除</Button>
        </div>
      )}

      {/* 筛选 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                view === v.key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-foreground-secondary hover:bg-surface',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索任务…"
              aria-label="搜索任务"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | TaskStatus)} className="w-32" aria-label="按状态筛选">
            <option value="all">全部状态</option>
            <option value="todo">待办</option>
            <option value="in_progress">进行中</option>
            <option value="done">已完成</option>
            <option value="cancelled">已取消</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as 'all' | TaskPriority)} className="w-28" aria-label="按优先级筛选">
            <option value="all">全部优先级</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </Select>
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={keyword || status !== 'all' || priority !== 'all' ? '没有符合这些条件的任务' : '还没有任务'}
          description={
            keyword || status !== 'all' || priority !== 'all'
              ? '清除筛选后再看看。'
              : '先新增一个任务，把它安排到今天或之后的日子。'
          }
          action={
            !keyword && status === 'all' && priority === 'all' ? (
              <Button variant="primary" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新增任务
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              moduleName={t.moduleId ? moduleNames.get(t.moduleId) : undefined}
              onToggleComplete={toggleComplete}
              onEdit={openDetail}
              onDelete={handleDelete}
              selectable={selectMode}
              selected={selected.has(t.id)}
              onSelectChange={toggleSelect}
            />
          ))}
        </div>
      )}

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} task={editing} />

      <TaskDetailDrawer
        task={detailTask}
        open={detailId != null}
        onClose={() => setDetailId(null)}
        onToggleComplete={toggleComplete}
        onEdit={(t) => {
          setDetailId(null)
          openEdit(t)
        }}
        onDelete={(t) => {
          setDetailId(null)
          handleDelete(t)
        }}
      />
    </div>
  )
}
