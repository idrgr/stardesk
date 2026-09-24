/**
 * 可测试的业务规则（纯函数）。统计与判定统一在此实现，页面不各自写算法。
 */

import type { Goal, Project, Task } from './entities'
import type { TaskStatus } from './enums'

/**
 * 逾期判定：只有「有截止日期且截止日期早于今天」的未完成任务才逾期。
 * 已取消、已完成、已删除的任务不标记为逾期。
 */
export function isTaskOverdue(task: Task, today: string): boolean {
  if (task.status === 'done' || task.status === 'cancelled') return false
  if (task.deletedAt) return false
  if (!task.dueDate) return false
  return task.dueDate < today
}

/** 任务是否为叶子任务（不存在未删除的子任务）。 */
export function isLeafTask(task: Task, all: Task[]): boolean {
  return !all.some((t) => t.parentTaskId === task.id && !t.deletedAt)
}

/** 返回某个任务的未删除子任务。 */
export function childrenOf(task: Task, all: Task[]): Task[] {
  return all.filter((t) => t.parentTaskId === task.id && !t.deletedAt)
}

/**
 * 由子任务推导父任务状态：
 * 全部子任务完成 → 完成；有子任务进行中 → 进行中；否则 → 待办。
 * 无未删除子任务时返回 null（视作叶子，保持自身状态）。
 */
export function deriveParentStatus(children: Task[]): TaskStatus | null {
  if (children.length === 0) return null
  if (children.every((c) => c.status === 'done')) return 'done'
  if (children.some((c) => c.status === 'in_progress')) return 'in_progress'
  return 'todo'
}

/** 目标关联的任务 ID 集合：直接关联 + 通过属于该目标的项目间接关联，按唯一 ID 去重。 */
export function goalTaskIds(goal: Goal, tasks: Task[], projects: Project[]): Set<string> {
  const projectIds = new Set(
    projects.filter((p) => p.goalId === goal.id).map((p) => p.id),
  )
  const ids = new Set<string>()
  for (const t of tasks) {
    if (t.deletedAt) continue
    if (t.goalId === goal.id) ids.add(t.id)
    else if (t.projectId && projectIds.has(t.projectId)) ids.add(t.id)
  }
  return ids
}

export interface GoalProgress {
  mode: 'auto' | 'manual'
  /** 0-100；自动模式无有效任务时为 null（表示「尚未拆解」）。 */
  percent: number | null
  totalTasks: number
  completedTasks: number
}

/**
 * 目标进度：
 * - 手动模式：直接使用 manualProgress（0-100）。
 * - 自动模式：已完成有效叶子任务数 / 全部有效叶子任务数；
 *   已取消、已删除不计入；父任务与子任务不重复计权。
 */
export function computeGoalProgress(
  goal: Goal,
  tasks: Task[],
  projects: Project[],
): GoalProgress {
  const ids = goalTaskIds(goal, tasks, projects)
  const goalTasks = tasks.filter((t) => ids.has(t.id))
  const leaves = goalTasks.filter((t) => isLeafTask(t, tasks))
  const effective = leaves.filter((t) => t.status !== 'cancelled')
  const total = effective.length
  const completed = effective.filter((t) => t.status === 'done').length

  if (goal.progressMode === 'manual') {
    return {
      mode: 'manual',
      percent: goal.manualProgress ?? null,
      totalTasks: total,
      completedTasks: completed,
    }
  }

  return {
    mode: 'auto',
    percent: total === 0 ? null : Math.round((completed / total) * 100),
    totalTasks: total,
    completedTasks: completed,
  }
}
