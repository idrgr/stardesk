import type { StarDeskDB } from '@/data/db/db'
import type { Goal } from '@/domain/entities'
import type { GoalStatus, ProgressMode } from '@/domain/enums'
import { nowIso } from '@/lib/id'
import { newBase, bump, emptyToNull } from './base'

export interface NewGoalInput {
  title: string
  description?: string
  moduleId: string
  startDate?: string | null
  targetDate?: string | null
  status?: GoalStatus
  progressMode?: ProgressMode
  manualProgress?: number | null
}

export async function createGoal(db: StarDeskDB, input: NewGoalInput): Promise<Goal> {
  const goal: Goal = {
    ...newBase(),
    moduleId: input.moduleId,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    startDate: emptyToNull(input.startDate),
    targetDate: emptyToNull(input.targetDate),
    status: input.status ?? 'not_started',
    progressMode: input.progressMode ?? 'auto',
    manualProgress:
      input.progressMode === 'manual' ? (input.manualProgress ?? 0) : null,
  }
  await db.goals.add(goal)
  return goal
}

export type GoalPatch = Partial<
  Pick<
    Goal,
    | 'title'
    | 'description'
    | 'moduleId'
    | 'startDate'
    | 'targetDate'
    | 'status'
    | 'progressMode'
    | 'manualProgress'
  >
>

export async function updateGoal(
  db: StarDeskDB,
  id: string,
  patch: GoalPatch,
): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const existing = await db.goals.get(id)
    if (!existing) throw new Error('目标不存在')
    const merged = bump({
      ...existing,
      ...patch,
      title: patch.title != null ? patch.title.trim() : existing.title,
      manualProgress:
        patch.progressMode === 'manual'
          ? patch.manualProgress ?? existing.manualProgress ?? 0
          : patch.progressMode === 'auto'
            ? null
            : existing.manualProgress,
    })
    await db.goals.put(merged)
    return merged
  })
}

export async function getGoal(db: StarDeskDB, id: string): Promise<Goal | undefined> {
  return db.goals.get(id)
}

export async function listGoals(db: StarDeskDB, opts: { includeDeleted?: boolean } = {}): Promise<Goal[]> {
  const all = await db.goals.toArray()
  const list = opts.includeDeleted ? all : all.filter((g) => !g.deletedAt)
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** 软删除目标（不删除其任务/项目/笔记）。 */
export async function softDeleteGoals(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const batchId = crypto.randomUUID()
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.goals, async () => {
    const goals = await db.goals.bulkGet(ids)
    for (const g of goals) {
      if (!g || g.deletedAt) continue
      await db.goals.put({
        ...g,
        deletedAt: now,
        deleteBatchId: batchId,
        updatedAt: now,
        revision: (g.revision ?? 0) + 1,
      })
      count++
    }
  })
  return count
}
