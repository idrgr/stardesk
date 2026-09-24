/**
 * 备份与恢复。
 *
 * 格式（见需求 10.2/10.3）：
 * - 外层 exportFormatVersion 与内层 schemaVersion 独立维护。
 * - 导出包含所有业务表、模块配置、习惯历史、归档及回收站内容和用户设置。
 * - 恢复只做「完整替换」，先完整校验再预览确认，最后单事务写入；任意失败回滚。
 * - 不导出函数、UI 临时状态、dataEpoch（恢复时生成新值）。
 */

import { z } from 'zod'
import type { StarDeskDB } from '@/data/db/db'
import { renewDataEpoch } from '@/data/db/db'
import { nowIso } from '@/lib/id'

export const BACKUP_APP_ID = 'stardesk'
export const EXPORT_FORMAT_VERSION = 1
export const SCHEMA_VERSION = 5

const id = z.string().min(1)
const iso = z.string()
const nullableIso = iso.nullable()
const nullableString = z.string().nullable()
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const baseEntitySchema = {
  id,
  createdAt: iso,
  updatedAt: iso,
  revision: z.number().int().min(1),
  deletedAt: nullableIso,
  deleteBatchId: nullableString,
}

const moduleSchema = z.object({
  ...baseEntitySchema,
  definitionKey: z.string(),
  name: z.string(),
  description: z.string(),
  iconKey: z.string(),
  colorKey: z.string(),
  order: z.number(),
  enabled: z.boolean(),
  capabilities: z.array(z.enum(['goals', 'projects', 'tasks', 'habits', 'notes', 'activities'])),
  archivedAt: nullableIso,
})

const taskSchema = z.object({
  ...baseEntitySchema,
  moduleId: nullableString,
  goalId: nullableString,
  projectId: nullableString,
  parentTaskId: nullableString,
  title: z.string(),
  description: z.string(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  priority: z.enum(['high', 'medium', 'low']),
  plannedDate: nullableString,
  scheduledTime: nullableString,
  dueDate: nullableString,
  estimatedMinutes: z.number().nullable(),
  tags: z.array(z.string()),
  completedAt: nullableIso,
  completedLocalDate: nullableString,
  archivedAt: nullableIso,
})

const dailyPlanSchema = z.object({
  localDate,
  orderedTaskIds: z.array(id),
  topTaskIds: z.array(id),
})

const goalSchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  title: z.string(),
  description: z.string(),
  startDate: nullableString,
  targetDate: nullableString,
  status: z.enum(['not_started', 'in_progress', 'done', 'archived']),
  progressMode: z.enum(['auto', 'manual']),
  manualProgress: z.number().nullable(),
})

const projectSchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  goalId: nullableString,
  title: z.string(),
  description: z.string(),
  projectType: z.string(),
  startDate: nullableString,
  targetDate: nullableString,
  status: z.enum(['active', 'on_hold', 'done', 'archived']),
  weeklyTargetMinutes: z.number().nullable(),
})

const habitSchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  goalId: nullableString,
  title: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  startDate: localDate,
  endDate: nullableString,
  scheduleVersions: z.array(
    z.object({
      effectiveFrom: localDate,
      frequency: z.object({ cadence: z.enum(['daily', 'weekly']), daysOfWeek: z.array(z.number()) }),
    }),
  ),
  pauseIntervals: z.array(z.object({ start: localDate, end: nullableString })),
  archivedAt: nullableIso,
})

const habitCheckinSchema = z.object({
  id,
  habitId: id,
  localDate,
  note: z.string(),
  createdAt: iso,
})

const activitySchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  projectId: nullableString,
  taskId: nullableString,
  kind: z.enum(['learning', 'hobby', 'workout', 'generic']),
  localDate,
  title: z.string(),
  durationMinutes: z.number().nullable(),
  note: z.string(),
  sourceFocusSessionId: nullableString,
  details: z.object({
    learning: z.object({ topic: z.string().optional(), takeaway: z.string().optional(), resourceIds: z.array(id).optional() }).optional(),
    hobby: z.object({ content: z.string().optional(), workLink: z.string().optional() }).optional(),
    workout: z.object({ workoutType: z.enum(['strength', 'running', 'cycling', 'swimming', 'yoga', 'walking', 'other']).optional(), intensity: z.number().optional(), distanceKm: z.number().optional() }).optional(),
  }),
})

const skillSchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  name: z.string(),
  currentLevel: z.number().int().min(1).max(5),
  targetLevel: z.number().int().min(1).max(5),
  description: z.string(),
  evidenceUrls: z.array(z.string()),
  learningProjectId: nullableString,
})

const bodyMeasurementSchema = z.object({
  ...baseEntitySchema,
  moduleId: id,
  localDate,
  weightKg: z.number().nullable(),
  note: z.string(),
})

const noteSchema = z.object({
  ...baseEntitySchema,
  moduleId: nullableString,
  projectId: nullableString,
  goalId: nullableString,
  title: z.string(),
  bodyMarkdown: z.string(),
  noteType: z.enum(['note', 'achievement', 'work']),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  archivedAt: nullableIso,
})

const resourceSchema = z.object({
  ...baseEntitySchema,
  moduleId: nullableString,
  projectId: nullableString,
  title: z.string(),
  url: z.string(),
  resourceType: z.enum(['article', 'video', 'course', 'book', 'other']),
  description: z.string(),
  tags: z.array(z.string()),
  readStatus: z.enum(['pending', 'read']),
  favorite: z.boolean(),
  archivedAt: nullableIso,
})

const focusSchema = z.object({
  ...baseEntitySchema,
  taskId: nullableString,
  moduleId: nullableString,
  status: z.enum(['running', 'paused', 'pending_confirm', 'done', 'abandoned', 'restore_pending']),
  plannedSeconds: z.number(),
  startedAt: iso,
  targetEndAt: nullableIso,
  activeSegmentStartedAt: nullableIso,
  pausedAt: nullableIso,
  accumulatedActiveSeconds: z.number(),
  endedAt: nullableIso,
  actualSeconds: z.number().nullable(),
  localDate: nullableString,
  note: z.string(),
})

const reviewSchema = z.object({
  ...baseEntitySchema,
  periodType: z.enum(['week', 'month']),
  startDate: localDate,
  endDate: localDate,
  status: z.enum(['draft', 'done']),
  answers: z.record(z.string(), z.string()),
  statsSnapshot: z.object({
    tasksCompleted: z.number(),
    learningMinutes: z.number(),
    hobbyMinutes: z.number(),
    workoutMinutes: z.number(),
    habitOpportunities: z.number(),
    habitCompleted: z.number(),
  }).nullable(),
  snapshotAt: nullableIso,
  nextActions: z.array(z.object({ title: z.string(), plannedDate: localDate, moduleId: nullableString })),
  convertedTaskIds: z.array(z.string()),
})

const settingsSchema = z.object({
  id: z.literal('settings'),
  nickname: z.string(),
  workspaceName: z.string(),
  theme: z.enum(['dark', 'light', 'system']),
  density: z.enum(['comfortable', 'compact']),
  timeZone: z.string(),
  weekStartsOn: z.number().int().min(0).max(6),
  focusPreferences: z.object({ defaultMinutes: z.number(), presets: z.array(z.number()) }),
  dashboardLayout: z.array(z.object({ id: z.string(), visible: z.boolean() })),
  onboardingCompleted: z.boolean(),
  lastExportInitiatedAt: nullableIso,
})

export const backupDataSchema = z.object({
  modules: z.array(moduleSchema),
  tasks: z.array(taskSchema),
  dailyPlans: z.array(dailyPlanSchema),
  goals: z.array(goalSchema),
  projects: z.array(projectSchema),
  habits: z.array(habitSchema),
  habitCheckins: z.array(habitCheckinSchema),
  activityLogs: z.array(activitySchema),
  skillAssessments: z.array(skillSchema),
  bodyMeasurements: z.array(bodyMeasurementSchema),
  notes: z.array(noteSchema),
  resources: z.array(resourceSchema),
  focusSessions: z.array(focusSchema),
  reviews: z.array(reviewSchema),
  settings: settingsSchema,
})

export const backupEnvelopeSchema = z.object({
  appId: z.literal(BACKUP_APP_ID),
  exportFormatVersion: z.number(),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  timeZone: z.string(),
  sourceSpace: z.enum(['personal', 'demo']),
  recordCounts: z.record(z.string(), z.number()),
  data: backupDataSchema,
})

export type BackupData = z.infer<typeof backupDataSchema>
export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>

const TABLES: (keyof BackupData)[] = [
  'modules',
  'tasks',
  'dailyPlans',
  'goals',
  'projects',
  'habits',
  'habitCheckins',
  'activityLogs',
  'skillAssessments',
  'bodyMeasurements',
  'notes',
  'resources',
  'focusSessions',
  'reviews',
]

/** 导出备份（一致快照：单事务读取所有表）。 */
export async function exportBackup(
  db: StarDeskDB,
  timeZone: string,
  sourceSpace: 'personal' | 'demo',
): Promise<BackupEnvelope> {
  const tables = [
    db.modules, db.tasks, db.dailyPlans, db.goals, db.projects, db.habits,
    db.habitCheckins, db.activityLogs, db.skillAssessments, db.bodyMeasurements,
    db.notes, db.resources, db.focusSessions, db.reviews, db.settings,
  ]
  const data = await db.transaction('r', tables, async () => {
      const [modules, tasks, dailyPlans, goals, projects, habits, habitCheckins, activityLogs, skillAssessments, bodyMeasurements, notes, resources, focusSessions, reviews, settings] = await Promise.all([
        db.modules.toArray(),
        db.tasks.toArray(),
        db.dailyPlans.toArray(),
        db.goals.toArray(),
        db.projects.toArray(),
        db.habits.toArray(),
        db.habitCheckins.toArray(),
        db.activityLogs.toArray(),
        db.skillAssessments.toArray(),
        db.bodyMeasurements.toArray(),
        db.notes.toArray(),
        db.resources.toArray(),
        db.focusSessions.toArray(),
        db.reviews.toArray(),
        db.settings.toArray(),
      ])
      return {
        modules, tasks, dailyPlans, goals, projects, habits, habitCheckins, activityLogs,
        skillAssessments, bodyMeasurements, notes, resources, focusSessions, reviews,
        settings: settings[0],
      }
    },
  )

  const recordCounts: Record<string, number> = {}
  for (const t of TABLES) recordCounts[t] = (data[t] as unknown[]).length
  recordCounts.settings = data.settings ? 1 : 0

  return {
    appId: BACKUP_APP_ID,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    timeZone,
    sourceSpace,
    recordCounts,
    data,
  }
}

function assertUniqueIds(rows: { id: string }[], table: string): void {
  const seen = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.id)) throw new Error(`备份校验失败：表 ${table} 存在重复 ID ${r.id}`)
    seen.add(r.id)
  }
}

/** 校验备份（结构、ID 唯一、唯一业务约束、悬空引用、模块能力）。失败抛出带原因的错误。 */
export function validateBackup(envelope: unknown): BackupEnvelope {
  const parsed = backupEnvelopeSchema.safeParse(envelope)
  if (!parsed.success) {
    throw new Error(`备份结构校验失败：${parsed.error.issues[0]?.path?.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}`)
  }
  const env = parsed.data
  if (env.exportFormatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`不支持的备份格式版本：${env.exportFormatVersion}`)
  }
  if (env.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`备份结构版本过新（${env.schemaVersion}），当前支持 ${SCHEMA_VERSION}`)
  }

  const d = env.data
  for (const t of TABLES) assertUniqueIds(d[t] as { id: string }[], t)

  // 唯一业务约束：习惯打卡、体重。
  const habitCheckinKeys = new Set<string>()
  for (const c of d.habitCheckins) {
    const k = `${c.habitId}|${c.localDate}`
    if (habitCheckinKeys.has(k)) throw new Error('备份校验失败：习惯打卡存在重复记录')
    habitCheckinKeys.add(k)
  }
  const bodyKeys = new Set<string>()
  for (const b of d.bodyMeasurements) {
    const k = `${b.moduleId}|${b.localDate}`
    if (bodyKeys.has(k)) throw new Error('备份校验失败：体重记录存在重复')
    bodyKeys.add(k)
  }

  // 悬空引用校验。
  const ids = {
    modules: new Set(d.modules.map((x) => x.id)),
    goals: new Set(d.goals.map((x) => x.id)),
    projects: new Set(d.projects.map((x) => x.id)),
    tasks: new Set(d.tasks.map((x) => x.id)),
    habits: new Set(d.habits.map((x) => x.id)),
    focusSessions: new Set(d.focusSessions.map((x) => x.id)),
  }
  for (const t of d.tasks) {
    if (t.projectId && !ids.projects.has(t.projectId)) throw new Error(`备份校验失败：任务 ${t.id} 引用不存在的项目`)
    if (t.goalId && !ids.goals.has(t.goalId)) throw new Error(`备份校验失败：任务 ${t.id} 引用不存在的目标`)
    if (t.parentTaskId && !ids.tasks.has(t.parentTaskId)) throw new Error(`备份校验失败：任务 ${t.id} 引用不存在的父任务`)
  }
  for (const p of d.projects) {
    if (p.goalId && !ids.goals.has(p.goalId)) throw new Error(`备份校验失败：项目 ${p.id} 引用不存在的目标`)
  }
  for (const h of d.habits) {
    if (h.goalId && !ids.goals.has(h.goalId)) throw new Error(`备份校验失败：习惯 ${h.id} 引用不存在的目标`)
  }
  for (const c of d.habitCheckins) {
    if (!ids.habits.has(c.habitId)) throw new Error(`备份校验失败：打卡引用不存在的习惯`)
  }
  for (const a of d.activityLogs) {
    if (a.sourceFocusSessionId && !ids.focusSessions.has(a.sourceFocusSessionId)) throw new Error(`备份校验失败：活动引用不存在的专注会话`)
  }

  // 模块能力/图标/颜色等由 zod 白名单与 registry 保证，此处无需额外检查。
  return env
}

/** 完整替换恢复：单事务清空并写入，成功后再更新 dataEpoch。 */
export async function importBackup(db: StarDeskDB, envelope: BackupEnvelope): Promise<void> {
  const d = envelope.data
  const tables = [
    db.modules, db.tasks, db.dailyPlans, db.goals, db.projects, db.habits,
    db.habitCheckins, db.activityLogs, db.skillAssessments, db.bodyMeasurements,
    db.notes, db.resources, db.focusSessions, db.reviews, db.settings,
  ]
  await db.transaction('rw', tables, async () => {
      await Promise.all([
        db.modules.clear(), db.tasks.clear(), db.dailyPlans.clear(), db.goals.clear(),
        db.projects.clear(), db.habits.clear(), db.habitCheckins.clear(), db.activityLogs.clear(),
        db.skillAssessments.clear(), db.bodyMeasurements.clear(), db.notes.clear(),
        db.resources.clear(), db.focusSessions.clear(), db.reviews.clear(), db.settings.clear(),
      ])
      await Promise.all([
        db.modules.bulkAdd(d.modules),
        db.tasks.bulkAdd(d.tasks),
        db.dailyPlans.bulkAdd(d.dailyPlans),
        db.goals.bulkAdd(d.goals),
        db.projects.bulkAdd(d.projects),
        db.habits.bulkAdd(d.habits),
        db.habitCheckins.bulkAdd(d.habitCheckins),
        db.activityLogs.bulkAdd(d.activityLogs),
        db.skillAssessments.bulkAdd(d.skillAssessments),
        db.bodyMeasurements.bulkAdd(d.bodyMeasurements),
        db.notes.bulkAdd(d.notes),
        db.resources.bulkAdd(d.resources),
        db.focusSessions.bulkAdd(normalizeRestoredSessions(d.focusSessions)),
        db.reviews.bulkAdd(d.reviews),
        ...(d.settings ? [db.settings.add(d.settings)] : []),
      ])
    },
  )
  await renewDataEpoch(db)
}

/**
 * 恢复备份时的专注会话归一化（需求 10.3）：
 * 备份中处于「运行中 / 暂停」的会话一律标记为「待确认恢复」，
 * 不自动继续倒计时，也不会重复生成专注记录；由用户在界面上确认实际时长或放弃。
 */
export function normalizeRestoredSessions(
  sessions: BackupData['focusSessions'],
): BackupData['focusSessions'] {
  return sessions.map((s) =>
    s.status === 'running' || s.status === 'paused'
      ? {
          ...s,
          status: 'restore_pending' as const,
          activeSegmentStartedAt: null,
          targetEndAt: null,
        }
      : s,
  )
}
