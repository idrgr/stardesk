import type { StarDeskDB } from '@/data/db/db'
import type { FocusSession } from '@/domain/entities'
import { newId, nowIso } from '@/lib/id'
import { elapsedActiveSeconds, computeTargetEndAt } from '@/domain/focus'
import { newBase } from './base'

/** 当前活动的会话（运行中或暂停）。 */
export async function getActiveSession(db: StarDeskDB): Promise<FocusSession | undefined> {
  const sessions = await db.focusSessions.toArray()
  return sessions.find((s) => s.status === 'running' || s.status === 'paused')
}

/**
 * 启动专注。事务内检查是否已有活动会话，避免双标签页重复创建。
 * 若已存在活动会话则直接返回它。
 */
export async function startFocus(
  db: StarDeskDB,
  input: { taskId?: string | null; moduleId?: string | null; plannedSeconds: number },
): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const existing = await getActiveSession(db)
    if (existing) return existing

    const nowMs = Date.now()
    const session: FocusSession = {
      ...newBase(),
      taskId: input.taskId ?? null,
      moduleId: input.moduleId ?? null,
      status: 'running',
      plannedSeconds: input.plannedSeconds,
      startedAt: nowIso(),
      targetEndAt: computeTargetEndAt(nowMs, input.plannedSeconds),
      activeSegmentStartedAt: nowIso(),
      pausedAt: null,
      accumulatedActiveSeconds: 0,
      endedAt: null,
      actualSeconds: null,
      localDate: null,
      note: '',
    }
    await db.focusSessions.add(session)
    return session
  })
}

/** 暂停：结算当前片段并清空起点。 */
export async function pauseFocus(db: StarDeskDB, id: string): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const s = await db.focusSessions.get(id)
    if (!s) throw new Error('会话不存在')
    if (s.status !== 'running') return s
    const nowMs = Date.now()
    const merged: FocusSession = {
      ...s,
      status: 'paused',
      accumulatedActiveSeconds: elapsedActiveSeconds(s, nowMs),
      activeSegmentStartedAt: null,
      targetEndAt: null,
      pausedAt: nowIso(),
    }
    await db.focusSessions.put(merged)
    return merged
  })
}

/** 继续：建立新起点并按剩余秒数重算 targetEndAt。 */
export async function resumeFocus(db: StarDeskDB, id: string): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const s = await db.focusSessions.get(id)
    if (!s) throw new Error('会话不存在')
    if (s.status !== 'paused') return s
    const nowMs = Date.now()
    const remaining = Math.max(0, s.plannedSeconds - s.accumulatedActiveSeconds)
    const merged: FocusSession = {
      ...s,
      status: 'running',
      activeSegmentStartedAt: nowIso(),
      targetEndAt: computeTargetEndAt(nowMs, remaining),
      pausedAt: null,
    }
    await db.focusSessions.put(merged)
    return merged
  })
}

/**
 * 确认结束（倒计时到点或用户主动结束）。
 * 结束结算与状态变更在同一事务；只生成一次专注记录。
 */
export async function completeFocus(
  db: StarDeskDB,
  id: string,
  localDate: string,
): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const s = await db.focusSessions.get(id)
    if (!s) throw new Error('会话不存在')
    if (s.status === 'done' || s.status === 'abandoned') return s
    const nowMs = Date.now()
    const actual = Math.round(elapsedActiveSeconds(s, nowMs))
    const merged: FocusSession = {
      ...s,
      status: 'done',
      accumulatedActiveSeconds: actual,
      activeSegmentStartedAt: null,
      targetEndAt: null,
      endedAt: nowIso(),
      actualSeconds: actual,
      localDate,
    }
    await db.focusSessions.put(merged)
    return merged
  })
}

/** 放弃会话。 */
export async function abandonFocus(db: StarDeskDB, id: string): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const s = await db.focusSessions.get(id)
    if (!s) throw new Error('会话不存在')
    if (s.status === 'done' || s.status === 'abandoned') return s
    const merged: FocusSession = {
      ...s,
      status: 'abandoned',
      activeSegmentStartedAt: null,
      targetEndAt: null,
      endedAt: nowIso(),
    }
    await db.focusSessions.put(merged)
    return merged
  })
}

export async function listCompletedSessions(db: StarDeskDB): Promise<FocusSession[]> {
  const sessions = await db.focusSessions.toArray()
  return sessions.filter((s) => s.status === 'done').sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

export async function listSessions(db: StarDeskDB): Promise<FocusSession[]> {
  const sessions = await db.focusSessions.toArray()
  return sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

/** 恢复备份后遗留的「待确认恢复」会话。 */
export async function getRestorePendingSession(db: StarDeskDB): Promise<FocusSession | undefined> {
  const sessions = await db.focusSessions.toArray()
  return sessions.find((s) => s.status === 'restore_pending')
}

/**
 * 确认「待确认恢复」会话的实际时长（或放弃）。
 * 确认后按用户填写的秒数结算，不把等待时间计入。
 */
export async function confirmRestoredFocus(
  db: StarDeskDB,
  id: string,
  input: { actualSeconds: number; localDate: string },
): Promise<FocusSession> {
  return db.transaction('rw', db.focusSessions, async () => {
    const s = await db.focusSessions.get(id)
    if (!s) throw new Error('会话不存在')
    if (s.status !== 'restore_pending') return s
    const actual = Math.max(0, Math.round(input.actualSeconds))
    const merged: FocusSession = {
      ...s,
      status: 'done',
      accumulatedActiveSeconds: actual,
      actualSeconds: actual,
      endedAt: s.endedAt ?? nowIso(),
      localDate: input.localDate,
      activeSegmentStartedAt: null,
      targetEndAt: null,
    }
    await db.focusSessions.put(merged)
    return merged
  })
}

export function sessionId(): string {
  return newId()
}
