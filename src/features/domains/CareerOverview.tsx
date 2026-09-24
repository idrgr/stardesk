import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Award, ArrowRight, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useData } from '@/app/data-context'
import { listGoals } from '@/data/repositories/goals'
import { listProjects } from '@/data/repositories/projects'
import { queryTasks } from '@/data/repositories/tasks'
import { queryNotes } from '@/data/repositories/notes'
import { listSkills, skillGap } from '@/data/repositories/assessments'
import { computeGoalProgress } from '@/domain/rules'
import type { ModuleConfig } from '@/domain/entities'
import { DomainHeader, DomainSection } from './shared'
import { SkillFormDialog } from './SkillFormDialog'
import { NoteEditorDialog } from '@/features/knowledge/NoteEditorDialog'

export function CareerOverview({ module }: { module: ModuleConfig }) {
  const { db } = useData()

  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const tasks = useLiveQuery(() => queryTasks(db, { includeArchived: true }), [db]) ?? []
  const notes = useLiveQuery(() => queryNotes(db, { moduleId: module.id, noteType: 'achievement' }), [db, module.id]) ?? []
  const skills = useLiveQuery(() => listSkills(db, module.id), [db, module.id]) ?? []

  const [skillOpen, setSkillOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const moduleGoals = useMemo(() => goals.filter((g) => g.moduleId === module.id && !g.deletedAt), [goals, module.id])
  const moduleTasks = useMemo(
    () => tasks.filter((t) => t.moduleId === module.id && !t.deletedAt && t.status !== 'done' && t.status !== 'cancelled'),
    [tasks, module.id],
  )

  return (
    <div className="flex flex-col gap-6">
      <DomainHeader
        module={module}
        action={
          <Button variant="primary" size="sm" onClick={() => setSkillOpen(true)}>
            <Plus className="h-4 w-4" />
            新增能力项
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DomainSection title="职业方向与目标">
            {moduleGoals.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有职业目标。可以用中性目标开始，例如「提升当前岗位的专业能力」。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {moduleGoals.map((g) => {
                  const p = computeGoalProgress(g, tasks, projects)
                  return (
                    <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                      <span className="flex-1 truncate text-sm text-foreground">{g.title}</span>
                      <span className="text-xs text-foreground-muted tnum">{p.percent == null ? '尚未拆解' : `${p.percent}%`}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </DomainSection>

          <DomainSection title="能力清单（当前 → 目标）">
            {skills.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有能力项。列出想提升的能力，看到差距再转成行动。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {skills.map((s) => {
                  const gap = skillGap(s)
                  return (
                    <div key={s.id} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-foreground-muted tnum">{s.currentLevel} → {s.targetLevel}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-foreground-muted">
                        {gap > 0 ? <span className="text-warning">差距 {gap} 级</span> : <span className="text-success">已达标</span>}
                        {s.learningProjectId && (
                          <span>关联学习项目：{projects.find((p) => p.id === s.learningProjectId)?.title ?? '已删除'}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DomainSection>
        </div>

        <div className="flex flex-col gap-6">
          <DomainSection title="职业行动（下一步任务）">
            {moduleTasks.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有职业行动任务。把能力差距拆成可执行的任务，加入今日计划。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {moduleTasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <ListChecks className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="flex-1 truncate text-sm text-foreground">{t.title}</span>
                    {t.plannedDate && <Badge tone="accent">已计划</Badge>}
                  </div>
                ))}
              </div>
            )}
          </DomainSection>

          <DomainSection
            title="成果与证据"
            action={
              <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
                <Plus className="h-4 w-4" />
                记录成果
              </Button>
            }
          >
            {notes.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有记录成果。把作品、证书、里程碑沉淀为「职业成果」。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <Award className="h-4 w-4 shrink-0 text-warning" />
                    <span className="flex-1 truncate text-sm text-foreground">{n.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                ))}
              </div>
            )}
          </DomainSection>
        </div>
      </div>

      <SkillFormDialog open={skillOpen} onClose={() => setSkillOpen(false)} moduleId={module.id} />
      <NoteEditorDialog open={noteOpen} onClose={() => setNoteOpen(false)} defaultModuleId={module.id} defaultNoteType="achievement" />
    </div>
  )
}
