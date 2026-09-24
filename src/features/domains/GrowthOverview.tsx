import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, BookOpen, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useData } from '@/app/data-context'
import { listGoals } from '@/data/repositories/goals'
import { listProjects } from '@/data/repositories/projects'
import { queryTasks } from '@/data/repositories/tasks'
import { queryActivities } from '@/data/repositories/activities'
import { queryNotes } from '@/data/repositories/notes'
import { listSkills } from '@/data/repositories/assessments'
import { computeGoalProgress } from '@/domain/rules'
import { formatDuration } from '@/lib/date'
import type { ModuleConfig } from '@/domain/entities'
import { DomainHeader, DomainSection } from './shared'
import { ActivityList, totalDuration } from '@/features/activities/ActivityList'
import { ActivityFormDialog } from '@/features/activities/ActivityFormDialog'
import { NoteEditorDialog } from '@/features/knowledge/NoteEditorDialog'
import { SkillFormDialog } from './SkillFormDialog'

export function GrowthOverview({ module }: { module: ModuleConfig }) {
  const { db } = useData()

  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const tasks = useLiveQuery(() => queryTasks(db, { includeArchived: true }), [db]) ?? []
  const activities = useLiveQuery(() => queryActivities(db, { moduleId: module.id, kind: 'learning' }), [db, module.id]) ?? []
  const notes = useLiveQuery(() => queryNotes(db, { moduleId: module.id }), [db, module.id]) ?? []
  const skills = useLiveQuery(() => listSkills(db, module.id), [db, module.id]) ?? []

  const [activityOpen, setActivityOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const moduleGoals = useMemo(() => goals.filter((g) => g.moduleId === module.id && !g.deletedAt), [goals, module.id])
  const moduleProjects = useMemo(() => projects.filter((p) => p.moduleId === module.id && !p.deletedAt), [projects, module.id])

  return (
    <div className="flex flex-col gap-6">
      <DomainHeader
        module={module}
        action={
          <Button variant="primary" size="sm" onClick={() => setActivityOpen(true)}>
            <Plus className="h-4 w-4" />
            记录学习
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DomainSection title="学习目标">
            {moduleGoals.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有学习目标。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {moduleGoals.slice(0, 3).map((g) => {
                  const p = computeGoalProgress(g, tasks, projects)
                  return (
                    <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                      <span className="flex-1 truncate text-sm text-foreground">{g.title}</span>
                      <span className="text-xs text-foreground-muted tnum">
                        {p.percent == null ? '尚未拆解' : `${p.percent}%`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </DomainSection>

          <DomainSection title="学习项目">
            {moduleProjects.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有学习项目。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {moduleProjects.map((p) => {
                  const pt = tasks.filter((t) => t.projectId === p.id && !t.deletedAt && t.status !== 'cancelled')
                  const done = pt.filter((t) => t.status === 'done').length
                  return (
                    <div key={p.id} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{p.title}</span>
                        <span className="text-xs text-foreground-muted tnum">{done}/{pt.length}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-raised">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pt.length === 0 ? 0 : (done / pt.length) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DomainSection>

          <DomainSection title="技能自评">
            {skills.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有技能自评。自评是主观记录，不代表客观测评。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {skills.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <span className="flex-1 truncate text-sm text-foreground">{s.name}</span>
                    <span className="text-xs text-foreground-muted tnum">
                      {s.currentLevel} → {s.targetLevel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DomainSection>
        </div>

        <div className="flex flex-col gap-6">
          <DomainSection
            title={`学习记录 · 累计 ${formatDuration(totalDuration(activities))}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setActivityOpen(true)}>
                <Plus className="h-4 w-4" />
                记录
              </Button>
            }
          >
            <ActivityList activities={activities.slice(0, 8)} emptyText="还没有学习记录。完成一次学习后，在这里留下记录。" />
          </DomainSection>

          <DomainSection
            title="最近笔记"
            action={
              <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
                <NotebookPen className="h-4 w-4" />
                新增笔记
              </Button>
            }
          >
            {notes.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有笔记。学习时记下收获，会沉淀在这里。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.slice(0, 5).map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <BookOpen className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="flex-1 truncate text-sm text-foreground">{n.title}</span>
                    {n.pinned && <Badge tone="accent">置顶</Badge>}
                  </div>
                ))}
              </div>
            )}
          </DomainSection>
        </div>
      </div>

      <ActivityFormDialog open={activityOpen} onClose={() => setActivityOpen(false)} module={module} />
      <NoteEditorDialog open={noteOpen} onClose={() => setNoteOpen(false)} defaultModuleId={module.id} />
    </div>
  )
}
