import type { StarDeskDB } from '@/data/db/db'
import type { Habit, HabitCheckin, HabitFrequency } from '@/domain/entities'
import { nowIso } from '@/lib/id'
import { addDaysToDate } from '@/lib/date'
import { newBase, bump, emptyToNull } from './base'
import { initialScheduleVersion } from '@/domain/habits'

export interface NewHabitInput {
  title: string
  description?: string
  moduleId: string
  goalId?: string | null
  startDate: string
  endDate?: string | null
  frequency: HabitFrequency
}

export async function createHabit(db: StarDeskDB, input: NewHabitInput): Promise<Habit> {
  const startDate = input.startDate
  const habit: Habit = {
    ...newBase(),
    moduleId: input.moduleId,
    goalId: emptyToNull(input.goalId),
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    enabled: true,
    startDate,
    endDate: emptyToNull(input.endDate),
    scheduleVersions: [initialScheduleVersion(startDate, input.frequency)],
    pauseIntervals: [],
    archivedAt: null,
  }
  await db.habits.add(habit)
  return habit
}

export type HabitPatch = Partial<
  Pick<Habit, 'title' | 'description' | 'enabled' | 'endDate'>
> & { frequency?: HabitFrequency }

/**
 * 更新习惯。修改频率时追加新的频率版本（自 today 起生效），保留历史安排；
 * 因此需要应用时区 today，调用方须传入。
 */
export async function updateHabit(
  db: StarDeskDB,
  id: string,
  patch: HabitPatch,
  today: string,
): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const existing = await db.habits.get(id)
    if (!existing) throw new Error('习惯不存在')

    const scheduleVersions =
      patch.frequency && patch.frequency !== existing.scheduleVersions.at(-1)?.frequency
        ? [...existing.scheduleVersions, { effectiveFrom: today, frequency: patch.frequency }]
        : existing.scheduleVersions

    const merged = bump({
      ...existing,
      title: patch.title != null ? patch.title.trim() : existing.title,
      description: patch.description != null ? patch.description : existing.description,
      enabled: patch.enabled ?? existing.enabled,
      endDate: patch.endDate !== undefined ? emptyToNull(patch.endDate) : existing.endDate,
      scheduleVersions,
    })
    await db.habits.put(merged)
    return merged
  })
}

/** 暂停（自 today 起）。若已有未闭合暂停区间则保持不变。 */
export async function pauseHabit(db: StarDeskDB, id: string, today: string): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const existing = await db.habits.get(id)
    if (!existing) throw new Error('习惯不存在')
    if (existing.pauseIntervals.some((p) => p.end == null)) return existing
    const merged = bump({
      ...existing,
      pauseIntervals: [...existing.pauseIntervals, { start: today, end: null }],
    })
    await db.habits.put(merged)
    return merged
  })
}

/** 恢复（自 today 起不再暂停）。 */
export async function resumeHabit(db: StarDeskDB, id: string, today: string): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const existing = await db.habits.get(id)
    if (!existing) throw new Error('习惯不存在')
    const yesterday = addDaysToDate(today, -1)
    const pauseIntervals = existing.pauseIntervals
      .map((p) => (p.end == null ? { ...p, end: yesterday } : p))
      .filter((p) => p.end != null && p.end >= p.start)
    const merged = bump({ ...existing, pauseIntervals })
    await db.habits.put(merged)
    return merged
  })
}

export async function listHabits(db: StarDeskDB, opts: { includeArchived?: boolean } = {}): Promise<Habit[]> {
  const all = await db.habits.toArray()
  const list = opts.includeArchived ? all : all.filter((h) => !h.archivedAt)
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getHabit(db: StarDeskDB, id: string): Promise<Habit | undefined> {
  return db.habits.get(id)
}

export async function listCheckinsForHabit(db: StarDeskDB, habitId: string): Promise<HabitCheckin[]> {
  return db.habitCheckins.where('habitId').equals(habitId).toArray()
}

/** 打卡（数据库唯一约束保证同一习惯同一日期仅一条）。禁止未来打卡。 */
export async function checkin(
  db: StarDeskDB,
  habitId: string,
  localDate: string,
  today: string,
  note = '',
): Promise<HabitCheckin | null> {
  if (localDate > today) throw new Error('不能补记未来日期')
  const habit = await db.habits.get(habitId)
  if (!habit) throw new Error('习惯不存在')
  if (localDate < habit.startDate) throw new Error('早于习惯开始日期')

  try {
    const record: HabitCheckin = {
      id: crypto.randomUUID(),
      habitId,
      localDate,
      note: note.trim(),
      createdAt: nowIso(),
    }
    await db.habitCheckins.add(record)
    return record
  } catch (e) {
    // 唯一约束冲突：视为已打卡，返回 null 表示无变化。
    if (e instanceof DOMException || (e as Error)?.name === 'ConstraintError') {
      return null
    }
    throw e
  }
}

/** 取消打卡。 */
export async function uncheckin(db: StarDeskDB, habitId: string, localDate: string): Promise<void> {
  const existing = await db.habitCheckins.where('[habitId+localDate]').equals([habitId, localDate]).first()
  if (existing) await db.habitCheckins.delete(existing.id)
}

/** 切换打卡状态；返回是否已打卡。 */
export async function toggleCheckin(
  db: StarDeskDB,
  habitId: string,
  localDate: string,
  today: string,
  note = '',
): Promise<boolean> {
  const existing = await db.habitCheckins
    .where('[habitId+localDate]')
    .equals([habitId, localDate])
    .first()
  if (existing) {
    await db.habitCheckins.delete(existing.id)
    return false
  }
  await checkin(db, habitId, localDate, today, note)
  return true
}
