import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { exportBackup, validateBackup, importBackup, SCHEMA_VERSION } from './backup/backup'
import { ensureBuiltinModules } from './repositories/modules'
import { createGoal } from './repositories/goals'
import { createProject } from './repositories/projects'
import { createTask } from './repositories/tasks'
import { createNote } from './repositories/notes'
import { createHabit, checkin } from './repositories/habits'
import { createActivity } from './repositories/activities'
import { ensureSettings } from './repositories/settings'
import { newId } from '@/lib/id'

let db1: StarDeskDB
let db2: StarDeskDB

beforeEach(() => {
  db1 = new StarDeskDB(`test-b1-${newId()}`)
  db2 = new StarDeskDB(`test-b2-${newId()}`)
})
afterEach(async () => {
  await db1.delete()
  await db2.delete()
})

async function seed(db: StarDeskDB) {
  const modules = await ensureBuiltinModules(db)
  await ensureSettings(db)
  const growth = modules.find((m) => m.definitionKey === 'growth')!
  const goal = await createGoal(db, { title: '学习', moduleId: growth.id })
  const project = await createProject(db, { title: '项目', moduleId: growth.id, goalId: goal.id })
  await createTask(db, { title: '任务', moduleId: growth.id, projectId: project.id, plannedDate: '2026-09-24' })
  await createNote(db, { title: '笔记', moduleId: growth.id, projectId: project.id })
  const habit = await createHabit(db, { title: '习惯', moduleId: growth.id, startDate: '2026-09-01', frequency: { cadence: 'daily', daysOfWeek: [] } })
  await checkin(db, habit.id, '2026-09-20', '2026-09-24')
  await createActivity(db, { kind: 'learning', moduleId: growth.id, localDate: '2026-09-23', title: '学习记录', durationMinutes: 30 })
}

describe('备份导出/恢复', () => {
  it('导出→恢复到新库后实体、关系与设置一致', async () => {
    await seed(db1)
    const envelope = await exportBackup(db1, 'Asia/Shanghai', 'personal')
    expect(envelope.appId).toBe('stardesk')
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION)

    await importBackup(db2, envelope)

    const tasks = await db2.tasks.toArray()
    const projects = await db2.projects.toArray()
    const goals = await db2.goals.toArray()
    expect(tasks).toHaveLength(1)
    expect(projects).toHaveLength(1)
    expect(goals).toHaveLength(1)
    // 关系保持：任务关联项目，项目关联目标
    expect(tasks[0].projectId).toBe(projects[0].id)
    expect(projects[0].goalId).toBe(goals[0].id)

    const settings = await db2.settings.get('settings')
    expect(settings).toBeTruthy()
    const notes = await db2.notes.toArray()
    expect(notes).toHaveLength(1)
  })

  it('损坏 JSON / 重复 ID / 未知版本被拒绝', async () => {
    await seed(db1)
    const envelope = await exportBackup(db1, 'Asia/Shanghai', 'personal')

    // 未知外层版本
    expect(() => validateBackup({ ...envelope, exportFormatVersion: 99 })).toThrow()

    // 未知结构版本
    expect(() => validateBackup({ ...envelope, schemaVersion: 999 })).toThrow()

    // 重复 ID
    const dup = JSON.parse(JSON.stringify(envelope))
    dup.data.tasks.push(dup.data.tasks[0])
    expect(() => validateBackup(dup)).toThrow(/重复 ID/)

    // 错误 appId
    expect(() => validateBackup({ ...envelope, appId: 'other' })).toThrow()

    // 悬空引用
    const dangling = JSON.parse(JSON.stringify(envelope))
    dangling.data.tasks = dangling.data.tasks.map((t: { projectId: string }) => ({ ...t, projectId: 'missing' }))
    expect(() => validateBackup(dangling)).toThrow(/引用不存在的项目/)
  })

  it('校验失败不改变原数据', async () => {
    await seed(db1)
    const before = await db1.tasks.count()

    const envelope = await exportBackup(db1, 'Asia/Shanghai', 'personal')
    const bad = JSON.parse(JSON.stringify(envelope))
    bad.data.tasks.push(bad.data.tasks[0]) // 制造重复 ID

    expect(() => validateBackup(bad)).toThrow()
    // 原库未被改动
    expect(await db1.tasks.count()).toBe(before)
  })
})
