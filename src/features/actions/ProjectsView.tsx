import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, FolderKanban, Pencil, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listProjects, softDeleteProjects } from '@/data/repositories/projects'
import { listGoals } from '@/data/repositories/goals'
import { queryTasks } from '@/data/repositories/tasks'
import { listEnabledModules } from '@/data/repositories/modules'
import { PROJECT_STATUS_LABEL } from '@/domain/enums'
import { formatDuration } from '@/lib/date'
import type { Project } from '@/domain/entities'
import { ProjectFormDialog } from './ProjectFormDialog'

export function ProjectsView() {
  const { db } = useData()
  const { toast } = useToast()

  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const tasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])
  const goalNames = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const handleDelete = async (p: Project) => {
    try {
      await softDeleteProjects(db, [p.id])
      toast('项目已移入回收站', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{projects.length} 个项目</p>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增项目
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="还没有项目"
          description="用项目承载多步骤计划，例如读完一本书、准备一次求职。"
          action={
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />
              新增项目
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {projects.map((p) => {
            const projectTasks = tasks.filter((t) => t.projectId === p.id)
            const active = projectTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
            return (
              <div key={p.id} className="group rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => { setEditing(p); setFormOpen(true) }}
                      className="block w-full text-left text-sm font-medium text-foreground hover:text-accent"
                    >
                      {p.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                      {moduleNames.get(p.moduleId) && <span>{moduleNames.get(p.moduleId)}</span>}
                      {p.goalId && goalNames.get(p.goalId) && <span>→ {goalNames.get(p.goalId)}</span>}
                      <Badge tone="neutral">{PROJECT_STATUS_LABEL[p.status]}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="编辑项目" onClick={() => { setEditing(p); setFormOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground-muted hover:text-danger" aria-label="删除项目" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-foreground-muted">
                  <span>{active.length} 项待办任务</span>
                  {p.weeklyTargetMinutes != null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      每周目标 {formatDuration(p.weeklyTargetMinutes)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProjectFormDialog open={formOpen} onClose={() => setFormOpen(false)} project={editing} />
    </div>
  )
}
