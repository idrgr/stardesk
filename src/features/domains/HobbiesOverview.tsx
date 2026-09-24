import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Heart, Palette } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { listProjects } from '@/data/repositories/projects'
import { queryActivities } from '@/data/repositories/activities'
import { queryNotes } from '@/data/repositories/notes'
import { weekRange } from '@/lib/date'
import { formatDuration } from '@/lib/date'
import type { ModuleConfig } from '@/domain/entities'
import { DomainHeader, DomainSection } from './shared'
import { ActivityList, totalDuration } from '@/features/activities/ActivityList'
import { ActivityFormDialog } from '@/features/activities/ActivityFormDialog'
import { NoteEditorDialog } from '@/features/knowledge/NoteEditorDialog'

export function HobbiesOverview({ module }: { module: ModuleConfig }) {
  const { db } = useData()
  const { settings } = useSettings()
  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const wr = weekRange(timeZone, settings?.weekStartsOn ?? 1)

  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const activities = useLiveQuery(() => queryActivities(db, { moduleId: module.id, kind: 'hobby' }), [db, module.id]) ?? []
  const works = useLiveQuery(() => queryNotes(db, { moduleId: module.id, noteType: 'work' }), [db, module.id]) ?? []

  const [activityOpen, setActivityOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const moduleProjects = useMemo(() => projects.filter((p) => p.moduleId === module.id && !p.deletedAt), [projects, module.id])
  const weekActivities = activities.filter((a) => a.localDate >= wr.start && a.localDate <= wr.end)

  return (
    <div className="flex flex-col gap-6">
      <DomainHeader
        module={module}
        action={
          <Button variant="primary" size="sm" onClick={() => setActivityOpen(true)}>
            <Plus className="h-4 w-4" />
            记录实践
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DomainSection title="兴趣项目">
            {moduleProjects.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有兴趣项目。摄影、绘画、音乐、写作……先开一个。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {moduleProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <Heart className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="flex-1 truncate text-sm text-foreground">{p.title}</span>
                    {p.projectType && p.projectType !== 'other' && <span className="text-xs text-foreground-muted">{p.projectType}</span>}
                  </div>
                ))}
              </div>
            )}
          </DomainSection>

          <DomainSection title={`本周投入 · ${formatDuration(totalDuration(weekActivities))}`}>
            <p className="text-sm text-foreground-muted">持续投入喜欢的事，不需要给自己压力。</p>
          </DomainSection>

          <DomainSection
            title="作品"
            action={
              <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
                <Plus className="h-4 w-4" />
                记录作品
              </Button>
            }
          >
            {works.length === 0 ? (
              <p className="text-sm text-foreground-muted">还没有作品。用「作品笔记 + 外部链接」保存你的成果。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {works.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <Palette className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="flex-1 truncate text-sm text-foreground">{w.title}</span>
                  </div>
                ))}
              </div>
            )}
          </DomainSection>
        </div>

        <DomainSection title={`实践记录 · 累计 ${formatDuration(totalDuration(activities))}`}>
          <ActivityList activities={activities.slice(0, 10)} emptyText="还没有实践记录。投入一次喜欢的事，然后在这里留下体验。" />
        </DomainSection>
      </div>

      <ActivityFormDialog open={activityOpen} onClose={() => setActivityOpen(false)} module={module} />
      <NoteEditorDialog open={noteOpen} onClose={() => setNoteOpen(false)} defaultModuleId={module.id} defaultNoteType="work" />
    </div>
  )
}
