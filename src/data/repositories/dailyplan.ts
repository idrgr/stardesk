import type { StarDeskDB } from '@/data/db/db'
import type { DailyPlan, Task } from '@/domain/entities'

export async function getDailyPlan(
  db: StarDeskDB,
  localDate: string,
): Promise<DailyPlan | undefined> {
  return db.dailyPlans.get(localDate)
}

/**
 * 计算某日计划的有效有序任务列表（纯函数）。
 * 顺序 = 既有 orderedTaskIds 中仍有效的任务 + 未列入顺序的有效任务（按创建时间）。
 */
export function resolveDailyPlanOrder(plan: DailyPlan | undefined, tasks: Task[]): Task[] {
  const valid = tasks.filter((t) => t.status !== 'cancelled')
  if (!plan) return valid.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const byId = new Map(valid.map((t) => [t.id, t]))
  const ordered: Task[] = []
  const seen = new Set<string>()
  for (const id of plan.orderedTaskIds) {
    const t = byId.get(id)
    if (t && !seen.has(id)) {
      ordered.push(t)
      seen.add(id)
    }
  }
  for (const t of valid.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
    if (!seen.has(t.id)) ordered.push(t)
  }
  return ordered
}

/** 将任务加入某日计划（设置计划日期，并追加到顺序末尾）。 */
export async function addTaskToPlan(
  db: StarDeskDB,
  localDate: string,
  taskId: string,
): Promise<DailyPlan> {
  return db.transaction('rw', db.tasks, db.dailyPlans, async () => {
    const task = await db.tasks.get(taskId)
    if (!task) throw new Error('任务不存在')

    // 若任务原来有别的计划日期，先从旧日期计划中清理。
    if (task.plannedDate && task.plannedDate !== localDate) {
      await removeFromPlan(db, task.plannedDate, taskId)
    }
    await db.tasks.put({ ...task, plannedDate: localDate })

    const existing = await db.dailyPlans.get(localDate)
    if (existing) {
      const ids = existing.orderedTaskIds.includes(taskId)
        ? existing.orderedTaskIds
        : [...existing.orderedTaskIds, taskId]
      const plan: DailyPlan = { ...existing, orderedTaskIds: ids }
      await db.dailyPlans.put(plan)
      return plan
    }
    const plan: DailyPlan = { localDate, orderedTaskIds: [taskId], topTaskIds: [] }
    await db.dailyPlans.add(plan)
    return plan
  })
}

/** 从某日计划中移除任务（清理顺序与重点引用）。 */
export async function removeFromPlan(db: StarDeskDB, localDate: string, taskId: string): Promise<void> {
  const plan = await db.dailyPlans.get(localDate)
  if (!plan) return
  const next: DailyPlan = {
    ...plan,
    orderedTaskIds: plan.orderedTaskIds.filter((id) => id !== taskId),
    topTaskIds: plan.topTaskIds.filter((id) => id !== taskId),
  }
  if (next.orderedTaskIds.length === 0 && next.topTaskIds.length === 0) {
    await db.dailyPlans.delete(localDate)
  } else {
    await db.dailyPlans.put(next)
  }
}

/** 设为今日重点（最多三项）。返回是否成功（超出上限返回 false）。 */
export async function setTopTask(
  db: StarDeskDB,
  localDate: string,
  taskId: string,
): Promise<boolean> {
  return db.transaction('rw', db.dailyPlans, async () => {
    const existing = await db.dailyPlans.get(localDate)
    const plan: DailyPlan = existing ?? { localDate, orderedTaskIds: [], topTaskIds: [] }
    if (plan.topTaskIds.includes(taskId)) return true
    if (plan.topTaskIds.length >= 3) return false
    const next: DailyPlan = {
      ...plan,
      topTaskIds: [...plan.topTaskIds, taskId],
      orderedTaskIds: plan.orderedTaskIds.includes(taskId)
        ? plan.orderedTaskIds
        : [...plan.orderedTaskIds, taskId],
    }
    await db.dailyPlans.put(next)
    return true
  })
}

export async function unsetTopTask(
  db: StarDeskDB,
  localDate: string,
  taskId: string,
): Promise<void> {
  const plan = await db.dailyPlans.get(localDate)
  if (!plan) return
  await db.dailyPlans.put({ ...plan, topTaskIds: plan.topTaskIds.filter((id) => id !== taskId) })
}
