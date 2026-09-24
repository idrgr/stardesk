import type { StarDeskDB } from '@/data/db/db'
import type { UserSettings } from '@/domain/entities'
import { defaultSettings } from '@/data/db/defaults'
import { nowIso } from '@/lib/id'

/** 只读读取设置（供 useLiveQuery 使用，不写入）。 */
export function getSettings(db: StarDeskDB): Promise<UserSettings | undefined> {
  return db.settings.get('settings')
}

/**
 * 读取设置；不存在时创建默认设置（仅在初始化/bootstrap 中调用，勿用于 liveQuery）。
 *
 * 必须在单个事务内完成「检查 + 写入」：否则会与用户操作竞争——
 * 例如用户在首次启动立即点击「创建我的空白工作台」写入 onboardingCompleted，
 * 而并发的 bootstrap 仍以「之前读到的不存在」为准写入默认设置，把用户的选择覆盖掉
 * （表现为页面闪回引导页）。同一 store 上的 IndexedDB 事务是串行的，因此事务化即可避免。
 */
export async function ensureSettings(db: StarDeskDB): Promise<UserSettings> {
  return db.transaction('rw', db.settings, async () => {
    const s = await db.settings.get('settings')
    if (s) return s
    const fresh = defaultSettings()
    await db.settings.add(fresh)
    return fresh
  })
}

export async function updateSettings(
  db: StarDeskDB,
  patch: Partial<Omit<UserSettings, 'id'>>,
): Promise<UserSettings> {
  return db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('settings')) ?? defaultSettings()
    const next: UserSettings = {
      ...current,
      ...patch,
      id: 'settings',
    }
    await db.settings.put(next)
    return next
  })
}

/** 记录最近一次发起导出时间。 */
export async function markExportInitiated(db: StarDeskDB): Promise<void> {
  await updateSettings(db, { lastExportInitiatedAt: nowIso() })
}
