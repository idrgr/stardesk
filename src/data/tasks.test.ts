import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import {
  createTask,
  queryTasks,
  completeTask,
  reopenTask,
  softDeleteTasks,
  restoreTasks,
  updateTask,
} from './repositories/tasks'
import { newId } from '@/lib/id'
import { todayInTimeZone } from '@/lib/date'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})

afterEach(async () => {
  await db.delete()
})

const TZ = 'Asia/Shanghai'

describe('任务仓储闭环', () => {
  it('创建任务后可从数据库读回，字段完整', async () => {
    const t = await createTask(db, {
      title: '  读完一章书  ',
      description: '第 3 章',
      priority: 'high',
      plannedDate: '2026-09-24',
      tags: ['阅读', '学习'],
    })
    expect(t.id).toBeTruthy()
    expect(t.title).toBe('读完一章书') // 去除首尾空格
    expect(t.status).toBe('todo')
    expect(t.revision).toBe(1)

    const list = await queryTasks(db, {})
    expect(list).toHaveLength(1)
    expect(list[0].tags).toEqual(['阅读', '学习'])
  })

  it('完成任务记录完成时间与本地日期；重新打开清除', async () => {
    const t = await createTask(db, { title: 'A' })
    const done = await completeTask(db, t.id, TZ)
    expect(done.status).toBe('done')
    expect(done.completedAt).toBeTruthy()
    expect(done.completedLocalDate).toBe(todayInTimeZone(TZ))

    const reopened = await reopenTask(db, t.id)
    expect(reopened.status).toBe('todo')
    expect(reopened.completedAt).toBeNull()
    expect(reopened.completedLocalDate).toBeNull()
  })

  it('软删除后默认查询排除，可恢复', async () => {
    const t = await createTask(db, { title: 'A' })
    const count = await softDeleteTasks(db, [t.id])
    expect(count).toBe(1)

    const visible = await queryTasks(db, {})
    expect(visible).toHaveLength(0)

    const all = await queryTasks(db, { includeDeleted: true })
    expect(all).toHaveLength(1)
    expect(all[0].deletedAt).toBeTruthy()

    const restored = await restoreTasks(db, [t.id])
    expect(restored).toBe(1)
    expect(await queryTasks(db, {})).toHaveLength(1)
  })

  it('编辑任务更新字段并递增 revision', async () => {
    const t = await createTask(db, { title: '旧标题' })
    const updated = await updateTask(db, t.id, { title: '  新标题  ' })
    expect(updated.title).toBe('新标题')
    expect(updated.revision).toBe(t.revision + 1)
  })

  it('筛选：关键词 / 领域 / 状态 / 优先级 / 计划日期', async () => {
    const a = await createTask(db, { title: '写周报', moduleId: 'm1', priority: 'high', plannedDate: '2026-09-24' })
    await createTask(db, { title: '读书', moduleId: 'm2', plannedDate: '2026-09-25' })
    await completeTask(db, a.id, TZ)

    expect(await queryTasks(db, { keyword: '周报' })).toHaveLength(1)
    expect(await queryTasks(db, { moduleId: 'm1' })).toHaveLength(1)
    expect(await queryTasks(db, { status: 'done' })).toHaveLength(1)
    expect(await queryTasks(db, { priority: 'high' })).toHaveLength(1)
    expect(await queryTasks(db, { plannedDate: '2026-09-24' })).toHaveLength(1)
    expect(await queryTasks(db, { includeDone: false })).toHaveLength(1)
  })
})
