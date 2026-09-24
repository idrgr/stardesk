import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Target, Pencil, Trash2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listGoals, softDeleteGoals } from '@/data/repositories/goals'
import { listProjects } from '@/data/repositories/projects'
import { queryTasks } from '@/data/repositories/tasks'
import { listEnabledModules } from '@/data/repositories/modules'
import { computeGoalProgress } from '@/domain/rules'
import { GOAL_STATUS_LABEL } from '@/domain/enums'
import type { Goal } from '@/domain/entities'
import { GoalFormDialog } from './GoalFormDialog'
import { cn } from '@/lib/cn'

export function GoalsView() {
  const { db } = useData()
  const { toast } = useToast()

  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const handleDelete = async (g: Goal) => {
    try {
      await softDeleteGoals(db, [g.id])
      toast('目标已移入回收站', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{goals.length} 个目标</p>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增目标
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="还没有目标"
          description="先定一个方向，把它拆成项目和任务。"
          action={
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />
              新增目标
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {goals.map((g) => {
            const progress = computeGoalProgress(g, tasks, projects)
            return (
              <div key={g.id} className="group rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => { setEditing(g); setFormOpen(true) }}
                      className="block w-full text-left text-sm font-medium text-foreground hover:text-accent"
                    >
                      {g.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                      {moduleNames.get(g.moduleId) && <span>{moduleNames.get(g.moduleId)}</span>}
                      <Badge tone="neutral">{GOAL_STATUS_LABEL[g.status]}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 sd-reveal-on-hover">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="编辑目标" onClick={() => { setEditing(g); setFormOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground-muted hover:text-danger" aria-label="删除目标" onClick={() => handleDelete(g)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                    <span>
                      {progress.mode === 'manual' ? '手动更新' : `${progress.completedTasks} / ${progress.totalTasks} 任务`}
                    </span>
                    <span className="tnum">
                      {progress.percent == null ? '尚未拆解' : `${progress.percent}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${progress.percent ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GoalFormDialog open={formOpen} onClose={() => setFormOpen(false)} goal={editing} />
    </div>
  )
}
