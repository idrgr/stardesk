import { describe, it, expect } from 'vitest'
import { taskInputSchema, activityInputSchema, isSafeUrl } from './validation'

const base = {
  title: '测试任务',
  description: '',
  moduleId: 'm1',
  goalId: null,
  projectId: null,
  parentTaskId: null,
  status: 'todo',
  priority: 'medium',
  plannedDate: '2026-09-24',
  dueDate: null,
  estimatedMinutes: null,
  tags: [],
}

describe('任务表单校验', () => {
  it('可选字段传 null 时应通过（数据库以 null 表示缺失）', () => {
    const r = taskInputSchema.safeParse({ ...base, scheduledTime: null })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('可选字段留空字符串时通过', () => {
    const r = taskInputSchema.safeParse({ ...base, scheduledTime: '', dueDate: '', estimatedMinutes: null })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('表单默认不填的字段（scheduledTime/estimatedMinutes 为 null）能保存', () => {
    // 这是真实用户路径：新增任务时只填标题与计划日期，其余留空。
    const r = taskInputSchema.safeParse({
      ...base,
      description: '',
      scheduledTime: null,
      dueDate: '',
      estimatedMinutes: null,
      tags: [],
    })
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('具体时间必须为 HH:mm', () => {
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: '09:30' }).success).toBe(true)
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: '25:00' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: '9:30' }).success).toBe(false)
  })

  it('标题去除首尾空格后不能为空', () => {
    expect(taskInputSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...base, title: '  有效  ' }).success).toBe(true)
  })

  it('时长不能为负', () => {
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: null, estimatedMinutes: -1 }).success).toBe(false)
  })

  it('日期格式非法时拒绝', () => {
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: null, plannedDate: '2026-13-01' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...base, scheduledTime: null, plannedDate: '2026-09-31' }).success).toBe(false)
  })
})

describe('活动记录校验', () => {
  it('接受类型化的 workout details', () => {
    const r = activityInputSchema.safeParse({
      kind: 'workout',
      moduleId: 'm1',
      localDate: '2026-09-24',
      title: '晨跑',
      durationMinutes: 30,
      details: { workout: { workoutType: 'running', distanceKm: 5, intensity: 3 } },
    })
    expect(r.success).toBe(true)
  })

  it('拒绝未知的运动类型', () => {
    const r = activityInputSchema.safeParse({
      kind: 'workout',
      moduleId: 'm1',
      localDate: '2026-09-24',
      title: '晨跑',
      details: { workout: { workoutType: '飞行' } },
    })
    expect(r.success).toBe(false)
  })
})

describe('链接协议白名单', () => {
  it('只接受 http / https', () => {
    expect(isSafeUrl('https://react.dev')).toBe(true)
    expect(isSafeUrl('http://example.com')).toBe(true)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,x')).toBe(false)
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeUrl('not a url')).toBe(false)
  })
})
