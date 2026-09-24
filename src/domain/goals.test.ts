import { describe, it, expect } from 'vitest'
import { computeGoalProgress, deriveParentStatus, goalTaskIds } from './rules'
import type { Goal, Project, Task } from './entities'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    moduleId: 'm1',
    goalId: null,
    projectId: null,
    parentTaskId: null,
    title: '任务',
    description: '',
    status: 'todo',
    priority: 'medium',
    plannedDate: null,
    scheduledTime: null,
    dueDate: null,
    estimatedMinutes: null,
    tags: [],
    completedAt: null,
    completedLocalDate: null,
    archivedAt: null,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    moduleId: 'm1',
    title: '目标',
    description: '',
    startDate: null,
    targetDate: null,
    status: 'in_progress',
    progressMode: 'auto',
    manualProgress: null,
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    moduleId: 'm1',
    goalId: 'g1',
    title: '项目',
    description: '',
    projectType: 'other',
    startDate: null,
    targetDate: null,
    status: 'active',
    weeklyTargetMinutes: null,
    ...overrides,
  }
}

describe('domain/rules 目标进度', () => {
  it('直接关联任务：1/2 完成 = 50%', () => {
    const goal = makeGoal()
    const tasks = [
      makeTask({ id: 'a', goalId: 'g1', status: 'done' }),
      makeTask({ id: 'b', goalId: 'g1', status: 'todo' }),
    ]
    const p = computeGoalProgress(goal, tasks, [])
    expect(p.percent).toBe(50)
    expect(p.totalTasks).toBe(2)
    expect(p.completedTasks).toBe(1)
  })

  it('通过项目间接关联的任务计入', () => {
    const goal = makeGoal()
    const projects = [makeProject({ id: 'p1', goalId: 'g1' })]
    const tasks = [makeTask({ id: 'a', projectId: 'p1', status: 'done' })]
    const p = computeGoalProgress(goal, tasks, projects)
    expect(p.percent).toBe(100)
  })

  it('同一任务同时关联目标与其项目时只计一次', () => {
    const goal = makeGoal()
    const projects = [makeProject({ id: 'p1', goalId: 'g1' })]
    const tasks = [makeTask({ id: 'a', goalId: 'g1', projectId: 'p1', status: 'done' })]
    const ids = goalTaskIds(goal, tasks, projects)
    expect(ids.size).toBe(1)
    const p = computeGoalProgress(goal, tasks, projects)
    expect(p.totalTasks).toBe(1)
  })

  it('已取消、已删除任务不计入分子分母', () => {
    const goal = makeGoal()
    const tasks = [
      makeTask({ id: 'a', goalId: 'g1', status: 'done' }),
      makeTask({ id: 'b', goalId: 'g1', status: 'cancelled' }),
      makeTask({ id: 'c', goalId: 'g1', status: 'todo', deletedAt: '2026-09-02T00:00:00.000Z' }),
    ]
    const p = computeGoalProgress(goal, tasks, [])
    expect(p.totalTasks).toBe(1)
    expect(p.percent).toBe(100)
  })

  it('父任务与子任务不重复计权，按叶子任务统计', () => {
    const goal = makeGoal()
    const tasks = [
      makeTask({ id: 'parent', goalId: 'g1', status: 'todo' }),
      makeTask({ id: 'child1', goalId: 'g1', parentTaskId: 'parent', status: 'done' }),
      makeTask({ id: 'child2', goalId: 'g1', parentTaskId: 'parent', status: 'todo' }),
    ]
    const p = computeGoalProgress(goal, tasks, [])
    expect(p.totalTasks).toBe(2) // 仅两个子任务
    expect(p.completedTasks).toBe(1)
    expect(p.percent).toBe(50)
  })

  it('无有效任务显示尚未拆解（percent 为 null）', () => {
    const goal = makeGoal()
    const p = computeGoalProgress(goal, [], [])
    expect(p.totalTasks).toBe(0)
    expect(p.percent).toBeNull()
  })

  it('手动模式直接使用 manualProgress', () => {
    const goal = makeGoal({ progressMode: 'manual', manualProgress: 40 })
    const tasks = [makeTask({ id: 'a', goalId: 'g1', status: 'done' })]
    const p = computeGoalProgress(goal, tasks, [])
    expect(p.mode).toBe('manual')
    expect(p.percent).toBe(40)
  })
})

describe('domain/rules 父任务状态推导', () => {
  it('全部子任务完成 → 完成', () => {
    const children = [makeTask({ status: 'done' }), makeTask({ status: 'done' })]
    expect(deriveParentStatus(children)).toBe('done')
  })

  it('有子任务进行中 → 进行中', () => {
    const children = [makeTask({ status: 'done' }), makeTask({ status: 'in_progress' })]
    expect(deriveParentStatus(children)).toBe('in_progress')
  })

  it('取消子任务后父任务不再完成', () => {
    const children = [makeTask({ status: 'done' }), makeTask({ status: 'cancelled' })]
    expect(deriveParentStatus(children)).toBe('todo')
  })

  it('无子任务返回 null', () => {
    expect(deriveParentStatus([])).toBeNull()
  })
})
