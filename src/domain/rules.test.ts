import { describe, it, expect } from 'vitest'
import { isTaskOverdue } from './rules'
import type { Task } from './entities'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    moduleId: null,
    goalId: null,
    projectId: null,
    parentTaskId: null,
    title: '测试任务',
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

describe('domain/rules 逾期判定', () => {
  const today = '2026-09-24'

  it('有截止日期且早于今天的未完成任务逾期', () => {
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-23' }), today)).toBe(true)
  })

  it('截止日期等于今天不逾期', () => {
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-24' }), today)).toBe(false)
  })

  it('截止日期在未来不逾期', () => {
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-25' }), today)).toBe(false)
  })

  it('无截止日期不逾期', () => {
    expect(isTaskOverdue(makeTask({ dueDate: null }), today)).toBe(false)
  })

  it('已完成、已取消、已删除不逾期', () => {
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-23', status: 'done' }), today)).toBe(false)
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-23', status: 'cancelled' }), today)).toBe(false)
    expect(isTaskOverdue(makeTask({ dueDate: '2026-09-23', deletedAt: '2026-09-20T00:00:00.000Z' }), today)).toBe(false)
  })
})
