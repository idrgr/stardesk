/**
 * 任务仓储：持久化 + 任务相关业务规则。
 * 业务数据以数据库为唯一持久化来源；这里不维护与数据库竞争的副本。
 */

import type { StarDeskDB } from '@/data/db/db'
import type { Task } from '@/domain/entities'
import type { TaskPriority, TaskStatus } from '@/domain/enums'
import { newId, nowIso } from '@/lib/id'
import { todayInTimeZone } from '@/lib/date'
import { deriveParentStatus } from '@/domain/rules'
import { removeFromPlan } from './dailyplan'
import { newBase, bump, emptyToNull, RevisionConflictError } from './base'

export interface TaskFilter {
  keyword?: string
  moduleId?: string | null
  goalId?: string | null
  projectId?: string | null
  status?: TaskStatus | TaskStatus[]
  priority?: TaskPriority
  plannedDate?: string | null // 精确匹配某天
  plannedOnOrBefore?: string
  plannedOnOrAfter?: string
  dueOnOrBefore?: string
  includeDone?: boolean
  includeCancelled?: boolean
  includeDeleted?: boolean
  includeArchived?: boolean
}

export type NewTaskInput = {
  title: string
  description?: string
  moduleId?: string | null
  goalId?: string | null
  projectId?: string | null
  parentTaskId?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  plannedDate?: string | null
  scheduledTime?: string | null
  dueDate?: string | null
  estimatedMinutes?: number | null
  tags?: string[]
}

/** 任务关联项目时继承该项目的 goalId。 */
async function resolveGoalForProject(db: StarDeskDB, projectId: string | null): Promise<string | null> {
  if (!projectId) return null
  const project = await db.projects.get(projectId)
  return project ? project.goalId : null
}

export async function createTask(db: StarDeskDB, input: NewTaskInput): Promise<Task> {
  return db.transaction('rw', db.tasks, db.projects, async () => {
    const projectId = emptyToNull(input.projectId)
    // 有项目时继承项目目标；没有项目时用直接传入的目标。
    const goalId = projectId ? await resolveGoalForProject(db, projectId) : emptyToNull(input.goalId)
    const task: Task = {
      ...newBase(),
      moduleId: emptyToNull(input.moduleId),
      goalId,
      projectId,
      parentTaskId: emptyToNull(input.parentTaskId),
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      plannedDate: emptyToNull(input.plannedDate),
      scheduledTime: input.scheduledTime?.trim() || null,
      dueDate: emptyToNull(input.dueDate),
      estimatedMinutes: input.estimatedMinutes == null ? null : input.estimatedMinutes,
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      completedAt: null,
      completedLocalDate: null,
      archivedAt: null,
    }
    await db.tasks.add(task)
    return task
  })
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'moduleId'
    | 'goalId'
    | 'projectId'
    | 'parentTaskId'
    | 'status'
    | 'priority'
    | 'plannedDate'
    | 'scheduledTime'
    | 'dueDate'
    | 'estimatedMinutes'
    | 'tags'
  >
>

/** 状态变化后同步父任务状态（父任务完成态由子任务决定）。 */
async function syncParentStatus(db: StarDeskDB, childId: string): Promise<void> {
  const child = await db.tasks.get(childId)
  if (!child || !child.parentTaskId) return
  const parent = await db.tasks.get(child.parentTaskId)
  if (!parent || parent.deletedAt) return
  const children = await db.tasks.where('parentTaskId').equals(parent.id).toArray()
  const activeChildren = children.filter((c) => !c.deletedAt)
  const next = deriveParentStatus(activeChildren)
  if (next && next !== parent.status) {
    await db.tasks.put(bump({ ...parent, status: next }))
  }
}

export async function updateTask(
  db: StarDeskDB,
  id: string,
  patch: TaskPatch,
  expectedRevision?: number,
): Promise<Task> {
  return db.transaction('rw', db.tasks, db.projects, db.dailyPlans, async () => {
    const existing = await db.tasks.get(id)
    if (!existing) throw new Error('任务不存在')

    // 多标签页冲突检测：若已被其他页面修改，不静默覆盖。
    if (expectedRevision != null && existing.revision !== expectedRevision) {
      throw new RevisionConflictError(id)
    }

    let goalId = existing.goalId
    if (patch.projectId !== undefined) {
      const projectId = emptyToNull(patch.projectId)
      goalId = projectId ? await resolveGoalForProject(db, projectId) : patch.goalId !== undefined ? emptyToNull(patch.goalId) : null
    } else if (patch.goalId !== undefined) {
      goalId = emptyToNull(patch.goalId)
    }

    const nextPlannedDate =
      patch.plannedDate !== undefined ? emptyToNull(patch.plannedDate) : existing.plannedDate

    const merged: Task = bump({
      ...existing,
      ...patch,
      goalId,
      plannedDate: nextPlannedDate,
      projectId: patch.projectId !== undefined ? emptyToNull(patch.projectId) : existing.projectId,
      title: patch.title != null ? patch.title.trim() : existing.title,
      tags: patch.tags ? patch.tags.map((t) => t.trim()).filter(Boolean) : existing.tags,
    })
    await db.tasks.put(merged)

    // 改期/移除计划日期：清理旧日期计划中的顺序与重点引用。
    if (nextPlannedDate !== existing.plannedDate && existing.plannedDate) {
      await removeFromPlan(db, existing.plannedDate, id)
    }
    // 取消：从当日计划中清理（已完成保留在分母中）。
    if (patch.status === 'cancelled' && existing.status !== 'cancelled' && nextPlannedDate) {
      await removeFromPlan(db, nextPlannedDate, id)
    }
    if (patch.status !== undefined && patch.status !== existing.status) {
      await syncParentStatus(db, id)
    }
    return merged
  })
}

/** 完成任务：记录 completedAt 与本地完成日期。 */
export async function completeTask(db: StarDeskDB, id: string, timeZone: string): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const existing = await db.tasks.get(id)
    if (!existing) throw new Error('任务不存在')
    if (existing.status === 'done') return existing
    const merged = bump({
      ...existing,
      status: 'done' as const,
      completedAt: nowIso(),
      completedLocalDate: todayInTimeZone(timeZone),
    })
    await db.tasks.put(merged)
    await syncParentStatus(db, id)
    return merged
  })
}

/** 重新打开已完成任务：清除完成字段，回到待办。 */
export async function reopenTask(db: StarDeskDB, id: string): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const existing = await db.tasks.get(id)
    if (!existing) throw new Error('任务不存在')
    if (existing.status !== 'done') return existing
    const merged = bump({
      ...existing,
      status: 'todo' as const,
      completedAt: null,
      completedLocalDate: null,
    })
    await db.tasks.put(merged)
    await syncParentStatus(db, id)
    return merged
  })
}

/** 软删除：父子同批删除（只给本次尚未删除的任务写新批次，保留已删除任务原批次）。 */
export async function softDeleteTasks(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  return db.transaction('rw', db.tasks, db.dailyPlans, async () => {
    const all = await db.tasks.toArray()
    const toDelete = new Set<string>(ids)
    // 级联收集未删除子任务。
    let changed = true
    while (changed) {
      changed = false
      for (const t of all) {
        if (t.parentTaskId && toDelete.has(t.parentTaskId) && !toDelete.has(t.id)) {
          toDelete.add(t.id)
          changed = true
        }
      }
    }
    const batchId = newId()
    const now = nowIso()
    let count = 0
    for (const id of toDelete) {
      const t = all.find((x) => x.id === id)
      if (!t || t.deletedAt) continue
      await db.tasks.put({
        ...t,
        deletedAt: now,
        deleteBatchId: batchId,
        updatedAt: now,
        revision: (t.revision ?? 0) + 1,
      })
      // 已删除任务从当日计划中清理。
      if (t.plannedDate) await removeFromPlan(db, t.plannedDate, t.id)
      count++
    }
    return count
  })
}

/** 恢复软删除任务（同批）。 */
export async function restoreTasks(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  let count = 0
  await db.transaction('rw', db.tasks, async () => {
    const tasks = await db.tasks.bulkGet(ids)
    for (const t of tasks) {
      if (!t || !t.deletedAt) continue
      await db.tasks.put({
        ...t,
        deletedAt: null,
        deleteBatchId: null,
        updatedAt: nowIso(),
        revision: (t.revision ?? 0) + 1,
      })
      count++
    }
  })
  return count
}

export async function getTask(db: StarDeskDB, id: string): Promise<Task | undefined> {
  return db.tasks.get(id)
}

/** 归档任务（仅影响默认视图，历史统计仍包含）。 */
export async function archiveTasks(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.tasks, async () => {
    const tasks = await db.tasks.bulkGet(ids)
    for (const t of tasks) {
      if (!t || t.archivedAt || t.deletedAt) continue
      await db.tasks.put({
        ...t,
        archivedAt: now,
        updatedAt: now,
        revision: (t.revision ?? 0) + 1,
      })
      count++
    }
  })
  return count
}

/** 取消归档。 */
export async function unarchiveTasks(db: StarDeskDB, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  let count = 0
  await db.transaction('rw', db.tasks, async () => {
    const tasks = await db.tasks.bulkGet(ids)
    for (const t of tasks) {
      if (!t || !t.archivedAt) continue
      await db.tasks.put({
        ...t,
        archivedAt: null,
        updatedAt: nowIso(),
        revision: (t.revision ?? 0) + 1,
      })
      count++
    }
  })
  return count
}

/** 批量改期：设置计划日期（null 表示移除）。 */
export async function rescheduleTasks(db: StarDeskDB, ids: string[], plannedDate: string | null): Promise<number> {
  if (ids.length === 0) return 0
  let count = 0
  await db.transaction('rw', db.tasks, db.dailyPlans, async () => {
    const tasks = await db.tasks.bulkGet(ids)
    for (const t of tasks) {
      if (!t) continue
      const old = t.plannedDate
      await db.tasks.put({
        ...t,
        plannedDate,
        updatedAt: nowIso(),
        revision: (t.revision ?? 0) + 1,
      })
      if (old && old !== plannedDate) await removeFromPlan(db, old, t.id)
      count++
    }
  })
  return count
}

/** 查询任务。默认排除已删除；是否包含已完成/已取消由 include 开关控制。 */
export async function queryTasks(db: StarDeskDB, filter: TaskFilter = {}): Promise<Task[]> {
  let tasks = await db.tasks.toArray()

  if (!filter.includeDeleted) tasks = tasks.filter((t) => !t.deletedAt)
  if (!filter.includeArchived) tasks = tasks.filter((t) => !t.archivedAt)
  if (filter.includeDone === false) tasks = tasks.filter((t) => t.status !== 'done')
  if (filter.includeCancelled === false) tasks = tasks.filter((t) => t.status !== 'cancelled')
  if (filter.status != null) {
    const want = Array.isArray(filter.status) ? filter.status : [filter.status]
    tasks = tasks.filter((t) => want.includes(t.status))
  }
  if (filter.moduleId !== undefined) tasks = tasks.filter((t) => t.moduleId === filter.moduleId)
  if (filter.goalId !== undefined) tasks = tasks.filter((t) => t.goalId === filter.goalId)
  if (filter.projectId !== undefined) tasks = tasks.filter((t) => t.projectId === filter.projectId)
  if (filter.priority) tasks = tasks.filter((t) => t.priority === filter.priority)
  if (filter.plannedDate !== undefined) tasks = tasks.filter((t) => t.plannedDate === filter.plannedDate)
  if (filter.plannedOnOrBefore) tasks = tasks.filter((t) => t.plannedDate && t.plannedDate <= filter.plannedOnOrBefore!)
  if (filter.plannedOnOrAfter) tasks = tasks.filter((t) => t.plannedDate && t.plannedDate >= filter.plannedOnOrAfter!)
  if (filter.dueOnOrBefore) tasks = tasks.filter((t) => t.dueDate && t.dueDate <= filter.dueOnOrBefore!)
  if (filter.keyword) {
    const kw = filter.keyword.trim().toLowerCase()
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(kw) ||
        t.description.toLowerCase().includes(kw) ||
        t.tags.some((tag) => tag.toLowerCase().includes(kw)),
    )
  }

  tasks.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return tasks
}
