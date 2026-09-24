import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { newId } from '@/lib/id'
import { startFocus, completeFocus, getActiveSession } from './repositories/focus'
import { convertFocusToActivity, findActivityByFocusSession, createActivity } from './repositories/activities'
import { createTask, getTask } from './repositories/tasks'
import { markEpochStale, isEpochStale, StaleDataError, subscribeEpochChange, setKnownEpoch, publishEpochChange, getKnownEpoch, refreshEpochStaleFromHints } from './db/epoch'
import { exportBackup, normalizeRestoredSessions, importBackup } from './backup/backup'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('专注 → 领域活动 转换', () => {
  it('转换一次生成一条记录，重复转换不生成第二条', async () => {
    const s = await startFocus(db, { plannedSeconds: 60 })
    await completeFocus(db, s.id, '2026-09-24')

    const first = await convertFocusToActivity(db, {
      focusSessionId: s.id,
      moduleId: 'm1',
      kind: 'learning',
      localDate: '2026-09-24',
      title: '专注学习',
      durationMinutes: 25,
    })
    expect(first.created).toBe(true)

    const second = await convertFocusToActivity(db, {
      focusSessionId: s.id,
      moduleId: 'm1',
      kind: 'learning',
      localDate: '2026-09-24',
      title: '专注学习（重复点击）',
      durationMinutes: 25,
    })
    expect(second.created).toBe(false)
    expect(second.activity.id).toBe(first.activity.id)

    const all = await db.activityLogs.toArray()
    expect(all).toHaveLength(1)
    // 重复转换不会覆盖首次记录的内容
    expect(all[0].title).toBe('专注学习')
  })

  it('数据库层唯一约束兜底：同一会话不能写入第二条活动', async () => {
    const s = await startFocus(db, { plannedSeconds: 60 })
    await completeFocus(db, s.id, '2026-09-24')

    await createActivity(db, {
      kind: 'generic',
      moduleId: 'm1',
      localDate: '2026-09-24',
      title: '第一条',
      sourceFocusSessionId: s.id,
    })

    // 绕过应用层检查直接写入，应被唯一索引拒绝。
    await expect(
      createActivity(db, {
        kind: 'generic',
        moduleId: 'm1',
        localDate: '2026-09-24',
        title: '第二条',
        sourceFocusSessionId: s.id,
      }),
    ).rejects.toThrow()

    expect(await db.activityLogs.count()).toBe(1)
  })

  it('转换不修改关联任务状态，也不自动完成任务', async () => {
    const task = await createTask(db, { title: '关联任务' })
    const s = await startFocus(db, { plannedSeconds: 60, taskId: task.id })
    await completeFocus(db, s.id, '2026-09-24')

    await convertFocusToActivity(db, {
      focusSessionId: s.id,
      moduleId: 'm1',
      kind: 'generic',
      localDate: '2026-09-24',
      title: '专注',
      durationMinutes: 10,
    })

    const after = await getTask(db, task.id)
    expect(after?.status).toBe('todo')
    expect(after?.completedAt).toBeNull()
    // 转换出的活动保留来源会话与关联任务
    const activity = await findActivityByFocusSession(db, s.id)
    expect(activity?.taskId).toBe(task.id)
  })

  it('转换时写入用户选择的关联项目，而不是丢弃', async () => {
    const s = await startFocus(db, { plannedSeconds: 60 })
    await completeFocus(db, s.id, '2026-09-24')

    const first = await convertFocusToActivity(db, {
      focusSessionId: s.id,
      moduleId: 'm1',
      projectId: 'p-keep',
      kind: 'learning',
      localDate: '2026-09-24',
      title: '带项目的专注',
      durationMinutes: 20,
    })
    expect(first.created).toBe(true)
    expect(first.activity.projectId).toBe('p-keep')
  })
})

describe('dataEpoch 跨标签页失效', () => {
  it('置为陈旧后：读取仍可用，写入被拒绝，meta 写入不受影响', async () => {
    const task = await createTask(db, { title: '既有任务' })
    expect(isEpochStale(db.name)).toBe(false)

    markEpochStale(db.name, 'new-epoch')

    expect(isEpochStale(db.name)).toBe(true)
    // 读取不受影响
    expect((await db.tasks.toArray()).length).toBe(1)
    // 写入被拒绝
    await expect(createTask(db, { title: '新任务' })).rejects.toThrow(StaleDataError)
    await expect(db.tasks.put({ ...task, title: '改标题' })).rejects.toThrow(StaleDataError)
    await expect(db.tasks.delete(task.id)).rejects.toThrow(StaleDataError)
    // 数据未被改动
    expect((await getTask(db, task.id))?.title).toBe('既有任务')
    // meta 表（epoch 自身）仍可写
    await expect(db.meta.put({ key: 'k', value: 'v' })).resolves.toBeTruthy()
  })

  it('恢复事务自身不受守卫阻塞，并在完成后广播新 epoch', async () => {
    await createTask(db, { title: '待导出' })
    const envelope = await exportBackup(db, 'Asia/Shanghai', 'personal')

    setKnownEpoch(db.name, 'epoch-before')
    await importBackup(db, envelope)

    // 本标签页执行恢复后不被判定为陈旧，且已知 epoch 已更新
    expect(isEpochStale(db.name)).toBe(false)
    expect(getKnownEpoch(db.name)).not.toBe('epoch-before')
    // 恢复后仍可正常写入
    await expect(createTask(db, { title: '恢复后新增' })).resolves.toBeTruthy()
  })

  it('订阅者能收到失效通知', async () => {
    const seen: boolean[] = []
    const off = subscribeEpochChange(db.name, (d) => seen.push(d.stale))
    markEpochStale(db.name, 'x')
    off()
    expect(seen).toEqual([true])
  })

  it('publishEpochChange 使本标签页认可新 epoch', async () => {
    publishEpochChange(db.name, 'epoch-new')
    expect(getKnownEpoch(db.name)).toBe('epoch-new')
    expect(isEpochStale(db.name)).toBe(false)
  })

  it('refreshEpochStaleFromHints 从 localStorage 补检 epoch 变化', () => {
    const name = `poll-${newId()}`
    setKnownEpoch(name, 'epoch-a')
    localStorage.setItem(`stardesk.epoch.${name}`, JSON.stringify({ epoch: 'epoch-b' }))
    refreshEpochStaleFromHints(name)
    expect(isEpochStale(name)).toBe(true)
  })
})

describe('恢复时专注会话归一化', () => {
  it('运行中 / 暂停的会话恢复后标记为待确认恢复', async () => {
    const running = await startFocus(db, { plannedSeconds: 60 })
    const envelope = await exportBackup(db, 'Asia/Shanghai', 'personal')
    expect(envelope.data.focusSessions[0].status).toBe('running')

    const normalized = normalizeRestoredSessions(envelope.data.focusSessions)
    expect(normalized[0].status).toBe('restore_pending')
    expect(normalized[0].activeSegmentStartedAt).toBeNull()
    expect(normalized[0].targetEndAt).toBeNull()

    // 恢复到新库后不会被视为「活动会话」，不会自动继续计时
    const db2 = new StarDeskDB(`test-${newId()}`)
    try {
      await importBackup(db2, envelope)
      expect(await getActiveSession(db2)).toBeUndefined()
      const sessions = await db2.focusSessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].status).toBe('restore_pending')
    } finally {
      await db2.delete()
    }
    expect(running.id).toBeTruthy()
  })
})
