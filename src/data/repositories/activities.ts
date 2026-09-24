import type { StarDeskDB } from '@/data/db/db'
import type { ActivityLog } from '@/domain/entities'
import type { ActivityKind } from '@/domain/enums'
import { newBase, emptyToNull } from './base'

export interface NewActivityInput {
  kind: ActivityKind
  moduleId: string
  projectId?: string | null
  taskId?: string | null
  localDate: string
  title: string
  durationMinutes?: number | null
  note?: string
  details?: ActivityLog['details']
  sourceFocusSessionId?: string | null
}

export async function createActivity(db: StarDeskDB, input: NewActivityInput): Promise<ActivityLog> {
  const log: ActivityLog = {
    ...newBase(),
    moduleId: input.moduleId,
    projectId: emptyToNull(input.projectId),
    taskId: emptyToNull(input.taskId),
    kind: input.kind,
    localDate: input.localDate,
    title: input.title.trim(),
    durationMinutes: input.durationMinutes ?? null,
    note: (input.note ?? '').trim(),
    sourceFocusSessionId: emptyToNull(input.sourceFocusSessionId),
    details: input.details ?? {},
  }
  await db.activityLogs.add(log)
  return log
}

export interface ActivityFilter {
  moduleId?: string
  kind?: ActivityKind
  projectId?: string
  localDateFrom?: string
  localDateTo?: string
  sourceFocusSessionId?: string
}

export async function queryActivities(db: StarDeskDB, filter: ActivityFilter = {}): Promise<ActivityLog[]> {
  let list = await db.activityLogs.toArray()
  list = list.filter((a) => !a.deletedAt)
  if (filter.moduleId) list = list.filter((a) => a.moduleId === filter.moduleId)
  if (filter.kind) list = list.filter((a) => a.kind === filter.kind)
  if (filter.projectId) list = list.filter((a) => a.projectId === filter.projectId)
  if (filter.localDateFrom) list = list.filter((a) => a.localDate >= filter.localDateFrom!)
  if (filter.localDateTo) list = list.filter((a) => a.localDate <= filter.localDateTo!)
  if (filter.sourceFocusSessionId) list = list.filter((a) => a.sourceFocusSessionId === filter.sourceFocusSessionId)
  list.sort((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : a.createdAt < b.createdAt ? 1 : -1))
  return list
}

/** 判断某专注会话是否已转成活动（防止重复转换）。 */
export async function findActivityByFocusSession(db: StarDeskDB, focusSessionId: string): Promise<ActivityLog | undefined> {
  return db.activityLogs.where('sourceFocusSessionId').equals(focusSessionId).first()
}

export interface ConvertFocusInput {
  focusSessionId: string
  moduleId: string
  projectId?: string | null
  kind: ActivityKind
  localDate: string
  title: string
  durationMinutes: number | null
  note?: string
  details?: ActivityLog['details']
}

export interface ConvertFocusResult {
  activity: ActivityLog
  /** false 表示该专注会话此前已转换过，本次没有新建记录。 */
  created: boolean
}

/**
 * 把一次已完成的专注会话显式转为领域活动记录。
 *
 * - 幂等：同一 FocusSession 最多产生一条 ActivityLog。事务内先查
 *   sourceFocusSessionId，并且数据库对该字段有唯一约束作为兜底
 *   （并发/双击时第二个写入会被约束拒绝，再由本函数回读既有记录返回）。
 * - 不修改关联任务状态：专注结束不自动完成任务（需求 6.6）。
 */
export async function convertFocusToActivity(
  db: StarDeskDB,
  input: ConvertFocusInput,
): Promise<ConvertFocusResult> {
  return db.transaction('rw', db.activityLogs, db.focusSessions, async () => {
    const existing = await findActivityByFocusSession(db, input.focusSessionId)
    if (existing) return { activity: existing, created: false }

    const session = await db.focusSessions.get(input.focusSessionId)
    if (!session) throw new Error('专注会话不存在')

    const log: ActivityLog = {
      ...newBase(),
      moduleId: input.moduleId,
      projectId: emptyToNull(input.projectId),
      taskId: session.taskId,
      kind: input.kind,
      localDate: input.localDate,
      title: input.title.trim(),
      durationMinutes: input.durationMinutes,
      note: (input.note ?? '').trim(),
      sourceFocusSessionId: input.focusSessionId,
      details: input.details ?? {},
    }

    try {
      await db.activityLogs.add(log)
      return { activity: log, created: true }
    } catch (e) {
      // 唯一约束冲突（并发重复提交）：回读既有记录，仍不产生第二条。
      const raced = await findActivityByFocusSession(db, input.focusSessionId)
      if (raced) return { activity: raced, created: false }
      throw e
    }
  })
}
