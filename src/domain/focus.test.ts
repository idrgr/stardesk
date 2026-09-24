import { describe, it, expect } from 'vitest'
import { elapsedActiveSeconds, remainingSeconds, isExpired } from './focus'
import type { FocusSession } from './entities'

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 's1',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    taskId: null,
    moduleId: null,
    status: 'running',
    plannedSeconds: 60,
    startedAt: '2026-09-24T10:00:00.000Z',
    targetEndAt: '2026-09-24T10:01:00.000Z',
    activeSegmentStartedAt: '2026-09-24T10:00:00.000Z',
    pausedAt: null,
    accumulatedActiveSeconds: 0,
    endedAt: null,
    actualSeconds: null,
    localDate: null,
    note: '',
    ...overrides,
  }
}

const START = Date.parse('2026-09-24T10:00:00.000Z')

describe('domain/focus 运行片段模型', () => {
  it('运行中累计活跃秒数 = 已结算 + 当前片段', () => {
    const s = makeSession({ accumulatedActiveSeconds: 20, activeSegmentStartedAt: '2026-09-24T10:00:00.000Z' })
    expect(elapsedActiveSeconds(s, START + 10_000)).toBe(30)
  })

  it('等待时间（超过 targetEndAt）不计入专注时长', () => {
    const s = makeSession({ targetEndAt: '2026-09-24T10:01:00.000Z' })
    // 现在已经 10:05，但时长封顶在 60 秒。
    expect(elapsedActiveSeconds(s, START + 300_000)).toBe(60)
  })

  it('剩余秒数 = 计划时长 - 累计活跃秒数', () => {
    const s = makeSession({ accumulatedActiveSeconds: 40 })
    expect(remainingSeconds(s, START)).toBe(20)
  })

  it('倒计时到点后 isExpired 为真', () => {
    expect(isExpired(makeSession(), START + 61_000)).toBe(true)
    expect(isExpired(makeSession(), START + 30_000)).toBe(false)
    expect(isExpired(makeSession({ status: 'paused', targetEndAt: null }), START + 61_000)).toBe(false)
  })
})
