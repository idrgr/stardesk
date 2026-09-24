import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { createActivity, queryActivities } from './repositories/activities'
import { createNote, queryNotes } from './repositories/notes'
import { createResource, queryResources } from './repositories/resources'
import { createSkill, listSkills, skillGap, upsertBodyMeasurement, listBodyMeasurements } from './repositories/assessments'
import { newId } from '@/lib/id'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('活动记录', () => {
  it('创建学习/运动记录并保存类型化 details', async () => {
    const learning = await createActivity(db, {
      kind: 'learning',
      moduleId: 'm1',
      localDate: '2026-09-24',
      title: '读《设计模式》',
      durationMinutes: 30,
      note: '理解了单例模式',
      details: { learning: { topic: '设计模式', takeaway: '单例' } },
    })
    expect(learning.details.learning?.topic).toBe('设计模式')

    const workout = await createActivity(db, {
      kind: 'workout',
      moduleId: 'm2',
      localDate: '2026-09-24',
      title: '晨跑',
      durationMinutes: 35,
      details: { workout: { workoutType: 'running', distanceKm: 5, intensity: 3 } },
    })
    expect(workout.details.workout?.distanceKm).toBe(5)

    const byModule = await queryActivities(db, { moduleId: 'm1' })
    expect(byModule).toHaveLength(1)
    const workouts = await queryActivities(db, { kind: 'workout' })
    expect(workouts).toHaveLength(1)
  })
})

describe('笔记与资源', () => {
  it('笔记搜索覆盖标题、正文、标签', async () => {
    await createNote(db, { title: '读书笔记', bodyMarkdown: '关于《刻意练习》', tags: ['成长'] })
    expect(await queryNotes(db, { keyword: '刻意练习' })).toHaveLength(1)
    expect(await queryNotes(db, { keyword: '成长' })).toHaveLength(1)
    expect(await queryNotes(db, { keyword: '读书' })).toHaveLength(1)
    expect(await queryNotes(db, { keyword: '不存在' })).toHaveLength(0)
  })

  it('资源记录待查看状态并可收藏', async () => {
    const r = await createResource(db, { title: 'React 文档', url: 'https://react.dev', resourceType: 'article' })
    expect(r.readStatus).toBe('pending')
    const fav = await queryResources(db, { favorite: true })
    expect(fav).toHaveLength(0)
  })
})

describe('技能自评与体重', () => {
  it('能力差距 = 目标等级 - 当前等级，下限为零', async () => {
    const skill = await createSkill(db, {
      moduleId: 'm1',
      name: 'TypeScript',
      currentLevel: 2,
      targetLevel: 4,
    })
    expect(skillGap(skill)).toBe(2)

    const exceeded = await createSkill(db, { moduleId: 'm1', name: 'Git', currentLevel: 5, targetLevel: 3 })
    expect(skillGap(exceeded)).toBe(0)
  })

  it('同一模块同一日期体重记录唯一（新输入更新）', async () => {
    await upsertBodyMeasurement(db, { moduleId: 'm1', localDate: '2026-09-24', weightKg: 70 })
    await upsertBodyMeasurement(db, { moduleId: 'm1', localDate: '2026-09-24', weightKg: 69.5 })

    const list = await listBodyMeasurements(db, 'm1')
    expect(list).toHaveLength(1)
    expect(list[0].weightKg).toBe(69.5)
  })
})
