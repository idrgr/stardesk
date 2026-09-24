/**
 * 专注计时业务规则（纯函数）。
 *
 * 统一采用「运行片段模型」：
 * - accumulatedActiveSeconds：已结算片段的秒数。
 * - activeSegmentStartedAt：当前片段起点（运行时存在）。
 * - targetEndAt：当前片段的目标结束时间（继续时按剩余秒数重算）。
 * 不使用另一套暂停时长算法；setInterval 只刷新显示，不作为时间真实性来源。
 */

import type { FocusSession } from './entities'

/** 已结算的累计活跃秒数（当前片段封顶在 targetEndAt，不把等待时间算入）。 */
export function elapsedActiveSeconds(session: FocusSession, nowMs: number): number {
  let total = session.accumulatedActiveSeconds
  if (session.status === 'running' && session.activeSegmentStartedAt) {
    const segmentStart = Date.parse(session.activeSegmentStartedAt)
    const segmentEnd = session.targetEndAt
      ? Math.min(nowMs, Date.parse(session.targetEndAt))
      : nowMs
    if (isFinite(segmentStart)) {
      total += Math.max(0, (segmentEnd - segmentStart) / 1000)
    }
  }
  return total
}

/** 剩余秒数（>=0）。 */
export function remainingSeconds(session: FocusSession, nowMs: number): number {
  return Math.max(0, session.plannedSeconds - elapsedActiveSeconds(session, nowMs))
}

/** 运行中且已达到目标结束时间 → 进入待确认。 */
export function isExpired(session: FocusSession, nowMs: number): boolean {
  return (
    session.status === 'running' &&
    session.targetEndAt != null &&
    nowMs >= Date.parse(session.targetEndAt)
  )
}

/** 计算目标结束时间（开始或继续时）：now + 剩余秒数。 */
export function computeTargetEndAt(nowMs: number, remainingSeconds: number): string {
  return new Date(nowMs + remainingSeconds * 1000).toISOString()
}

/** 将运行片段结算，返回结算后的累计秒数（供暂停/结束时使用）。 */
export function settleSegment(session: FocusSession, nowMs: number): number {
  return elapsedActiveSeconds(session, nowMs)
}
