import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { ensureBuiltinModules, createModule, updateModule, listModules } from './repositories/modules'
import { createTask, queryTasks } from './repositories/tasks'
import { newId } from '@/lib/id'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('普通自定义模块', () => {
  it('创建「旅行计划」后立即可用通用功能，改名不丢数据', async () => {
    await ensureBuiltinModules(db)
    const travel = await createModule(db, { name: '旅行计划', description: '整理行程', capabilities: ['tasks', 'goals', 'notes'] })
    expect(travel.definitionKey).toBe('generic')

    // 通用功能：加任务、加笔记
    const task = await createTask(db, { title: '订机票', moduleId: travel.id })
    const list = await listModules(db)
    expect(list.find((m) => m.id === travel.id)?.name).toBe('旅行计划')

    // 改名
    await updateModule(db, travel.id, { name: '环球旅行' })
    const renamed = await listModules(db)
    expect(renamed.find((m) => m.id === travel.id)?.name).toBe('环球旅行')

    // 数据不丢：任务仍关联该模块
    const tasks = await queryTasks(db, { moduleId: travel.id })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('订机票')
  })
})
