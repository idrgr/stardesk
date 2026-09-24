import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { createGoal } from './repositories/goals'
import { createProject, updateProject } from './repositories/projects'
import {
  createTask,
  updateTask,
  completeTask,
  softDeleteTasks,
  getTask,
} from './repositories/tasks'
import { RevisionConflictError } from './repositories/base'
import { addTaskToPlan, setTopTask, getDailyPlan } from './repositories/dailyplan'
import { newId } from '@/lib/id'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

const TZ = 'Asia/Shanghai'

describe('目标 → 项目 → 任务 关联', () => {
  it('任务关联项目时继承项目目标', async () => {
    const goal = await createGoal(db, { title: '目标', moduleId: 'm1' })
    const project = await createProject(db, { title: '项目', moduleId: 'm1', goalId: goal.id })
    const task = await createTask(db, { title: '任务', projectId: project.id })
    expect(task.goalId).toBe(goal.id)
    expect(task.projectId).toBe(project.id)
  })

  it('项目改目标时同步其任务目标', async () => {
    const g1 = await createGoal(db, { title: 'G1', moduleId: 'm1' })
    const g2 = await createGoal(db, { title: 'G2', moduleId: 'm1' })
    const project = await createProject(db, { title: 'P', moduleId: 'm1', goalId: g1.id })
    const task = await createTask(db, { title: 'T', projectId: project.id })
    expect(task.goalId).toBe(g1.id)

    await updateProject(db, project.id, { goalId: g2.id })
    const updatedTask = await getTask(db, task.id)
    expect(updatedTask?.goalId).toBe(g2.id)
  })

  it('项目无目标时其任务不单独绑定目标', async () => {
    const project = await createProject(db, { title: 'P', moduleId: 'm1', goalId: null })
    const task = await createTask(db, { title: 'T', projectId: project.id })
    expect(task.goalId).toBeNull()
  })
})

describe('子任务与父任务状态', () => {
  it('父任务完成态由子任务决定', async () => {
    const parent = await createTask(db, { title: '父' })
    const c1 = await createTask(db, { title: '子1', parentTaskId: parent.id })
    const c2 = await createTask(db, { title: '子2', parentTaskId: parent.id })

    await completeTask(db, c1.id, TZ)
    expect((await getTask(db, parent.id))?.status).toBe('todo')

    await completeTask(db, c2.id, TZ)
    expect((await getTask(db, parent.id))?.status).toBe('done')
  })

  it('软删除父任务级联删除子任务', async () => {
    const parent = await createTask(db, { title: '父' })
    await createTask(db, { title: '子', parentTaskId: parent.id })

    const count = await softDeleteTasks(db, [parent.id])
    expect(count).toBe(2) // 父 + 子
  })

  it('陈旧 revision 的编辑被拒绝，不静默覆盖', async () => {
    const t = await createTask(db, { title: '任务' }) // revision = 1
    await updateTask(db, t.id, { title: '任务 v2' }, t.revision) // 成功 → revision 2

    // 用旧 revision 再编辑，应报冲突
    await expect(updateTask(db, t.id, { title: '任务 v3' }, t.revision)).rejects.toThrow(RevisionConflictError)
    // 未被覆盖
    expect((await getTask(db, t.id))?.title).toBe('任务 v2')
  })
})

describe('今日计划', () => {
  it('加入计划并设为重点（最多三项）', async () => {
    const t1 = await createTask(db, { title: 'T1' })
    const t2 = await createTask(db, { title: 'T2' })
    const t3 = await createTask(db, { title: 'T3' })
    const t4 = await createTask(db, { title: 'T4' })

    await addTaskToPlan(db, '2026-09-24', t1.id)
    await addTaskToPlan(db, '2026-09-24', t2.id)
    expect((await getTask(db, t1.id))?.plannedDate).toBe('2026-09-24')

    expect(await setTopTask(db, '2026-09-24', t1.id)).toBe(true)
    expect(await setTopTask(db, '2026-09-24', t2.id)).toBe(true)
    expect(await setTopTask(db, '2026-09-24', t3.id)).toBe(true)
    expect(await setTopTask(db, '2026-09-24', t4.id)).toBe(false) // 超出 3 项

    const plan = await getDailyPlan(db, '2026-09-24')
    expect(plan?.topTaskIds).toHaveLength(3)
  })

  it('任务改期后清理旧日期计划引用', async () => {
    const t = await createTask(db, { title: 'T', plannedDate: '2026-09-24' })
    await addTaskToPlan(db, '2026-09-24', t.id)

    await updateTask(db, t.id, { plannedDate: '2026-09-25' })
    const oldPlan = await getDailyPlan(db, '2026-09-24')
    expect(oldPlan?.orderedTaskIds.includes(t.id)).toBeFalsy()
  })

  it('取消任务后从计划中清理', async () => {
    const t = await createTask(db, { title: 'T', plannedDate: '2026-09-24' })
    await addTaskToPlan(db, '2026-09-24', t.id)

    await updateTask(db, t.id, { status: 'cancelled' })
    const plan = await getDailyPlan(db, '2026-09-24')
    expect(plan?.orderedTaskIds.includes(t.id)).toBeFalsy()
  })
})
