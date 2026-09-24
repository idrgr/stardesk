import type { StarDeskDB } from '@/data/db/db'
import type { Project } from '@/domain/entities'
import type { ProjectStatus } from '@/domain/enums'
import { nowIso } from '@/lib/id'
import { newBase, bump, emptyToNull } from './base'

export interface NewProjectInput {
  title: string
  description?: string
  moduleId: string
  goalId?: string | null
  projectType?: string
  startDate?: string | null
  targetDate?: string | null
  status?: ProjectStatus
  weeklyTargetMinutes?: number | null
}

export async function createProject(db: StarDeskDB, input: NewProjectInput): Promise<Project> {
  const project: Project = {
    ...newBase(),
    moduleId: input.moduleId,
    goalId: emptyToNull(input.goalId),
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    projectType: input.projectType?.trim() || 'other',
    startDate: emptyToNull(input.startDate),
    targetDate: emptyToNull(input.targetDate),
    status: input.status ?? 'active',
    weeklyTargetMinutes: input.weeklyTargetMinutes ?? null,
  }
  await db.projects.add(project)
  return project
}

export type ProjectPatch = Partial<
  Pick<
    Project,
    | 'title'
    | 'description'
    | 'moduleId'
    | 'goalId'
    | 'projectType'
    | 'startDate'
    | 'targetDate'
    | 'status'
    | 'weeklyTargetMinutes'
  >
>

/**
 * 更新项目。当项目改目标时，在事务中同步其任务的 goalId（项目无目标时其任务也不单独绑定目标）。
 */
export async function updateProject(
  db: StarDeskDB,
  id: string,
  patch: ProjectPatch,
): Promise<Project> {
  return db.transaction('rw', db.projects, db.tasks, async () => {
    const existing = await db.projects.get(id)
    if (!existing) throw new Error('项目不存在')

    const nextGoalId =
      patch.goalId !== undefined ? emptyToNull(patch.goalId) : existing.goalId

    const merged = bump({
      ...existing,
      ...patch,
      goalId: nextGoalId,
      title: patch.title != null ? patch.title.trim() : existing.title,
    })
    await db.projects.put(merged)

    // 同步项目下任务的 goalId。
    if (patch.goalId !== undefined) {
      const tasks = await db.tasks.where('projectId').equals(id).toArray()
      for (const t of tasks) {
        if (t.goalId === nextGoalId) continue
        await db.tasks.put({
          ...t,
          goalId: nextGoalId,
          updatedAt: nowIso(),
          revision: (t.revision ?? 0) + 1,
        })
      }
    }
    return merged
  })
}

export async function getProject(db: StarDeskDB, id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function listProjects(db: StarDeskDB, opts: { includeDeleted?: boolean } = {}): Promise<Project[]> {
  const all = await db.projects.toArray()
  const list = opts.includeDeleted ? all : all.filter((p) => !p.deletedAt)
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function softDeleteProjects(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const batchId = crypto.randomUUID()
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.projects, async () => {
    const projects = await db.projects.bulkGet(ids)
    for (const p of projects) {
      if (!p || p.deletedAt) continue
      await db.projects.put({
        ...p,
        deletedAt: now,
        deleteBatchId: batchId,
        updatedAt: now,
        revision: (p.revision ?? 0) + 1,
      })
      count++
    }
  })
  return count
}
