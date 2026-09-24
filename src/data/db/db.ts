/**
 * IndexedDB 数据库定义（Dexie）。
 *
 * - 使用明确的版本号与增量迁移；新增表或字段时递增版本并提供完整 stores 定义。
 * - 个人空间与演示空间使用独立数据库（独立命名空间），互不复制。
 * - meta 表保存本地控制字段 dataEpoch（完整替换恢复时生成新值）。
 */

import Dexie, { type Table } from 'dexie'
import { installEpochWriteGuard, publishEpochChange, setKnownEpoch } from './epoch'
import type {
  ActivityLog,
  BodyMeasurement,
  DailyPlan,
  FocusSession,
  Goal,
  Habit,
  HabitCheckin,
  ModuleConfig,
  Note,
  Project,
  Resource,
  Review,
  SkillAssessment,
  Task,
  UserSettings,
} from '@/domain/entities'

export type DataSpace = 'personal' | 'demo'

const DB_NAMES: Record<DataSpace, string> = {
  personal: 'stardesk',
  demo: 'stardesk-demo',
}

export interface MetaRow {
  key: string
  value: string
}

export class StarDeskDB extends Dexie {
  meta!: Table<MetaRow, string>
  settings!: Table<UserSettings, string>
  modules!: Table<ModuleConfig, string>
  tasks!: Table<Task, string>
  dailyPlans!: Table<DailyPlan, string>
  goals!: Table<Goal, string>
  projects!: Table<Project, string>
  habits!: Table<Habit, string>
  habitCheckins!: Table<HabitCheckin, string>
  activityLogs!: Table<ActivityLog, string>
  skillAssessments!: Table<SkillAssessment, string>
  bodyMeasurements!: Table<BodyMeasurement, string>
  notes!: Table<Note, string>
  resources!: Table<Resource, string>
  focusSessions!: Table<FocusSession, string>
  reviews!: Table<Review, string>

  constructor(name: string) {
    super(name)

    this.version(1).stores({
      meta: 'key',
      settings: 'id',
      modules: 'id, definitionKey, order, enabled, archivedAt',
      tasks:
        'id, moduleId, goalId, projectId, parentTaskId, status, priority, plannedDate, dueDate, updatedAt, deletedAt',
      dailyPlans: 'localDate',
    })

    // 阶段 2：目标、项目、习惯、打卡。
    this.version(2).stores({
      meta: 'key',
      settings: 'id',
      modules: 'id, definitionKey, order, enabled, archivedAt',
      tasks:
        'id, moduleId, goalId, projectId, parentTaskId, status, priority, plannedDate, dueDate, updatedAt, deletedAt',
      dailyPlans: 'localDate',
      goals: 'id, moduleId, status, updatedAt, deletedAt',
      projects: 'id, moduleId, goalId, status, updatedAt, deletedAt',
      habits: 'id, moduleId, goalId, startDate, endDate, archivedAt',
      habitCheckins: 'id, habitId, localDate, &[habitId+localDate]',
    })

    // 阶段 3：活动记录、技能自评、体重、笔记、资源。
    this.version(3).stores({
      meta: 'key',
      settings: 'id',
      modules: 'id, definitionKey, order, enabled, archivedAt',
      tasks:
        'id, moduleId, goalId, projectId, parentTaskId, status, priority, plannedDate, dueDate, updatedAt, deletedAt',
      dailyPlans: 'localDate',
      goals: 'id, moduleId, status, updatedAt, deletedAt',
      projects: 'id, moduleId, goalId, status, updatedAt, deletedAt',
      habits: 'id, moduleId, goalId, startDate, endDate, archivedAt',
      habitCheckins: 'id, habitId, localDate, &[habitId+localDate]',
      activityLogs:
        'id, moduleId, projectId, taskId, kind, localDate, sourceFocusSessionId',
      skillAssessments: 'id, moduleId',
      bodyMeasurements: 'id, moduleId, localDate, &[moduleId+localDate]',
      notes: 'id, moduleId, projectId, goalId, noteType, pinned, archivedAt, updatedAt',
      resources: 'id, moduleId, projectId, resourceType, readStatus, favorite, archivedAt',
    })

    // 阶段 4：专注会话、周期复盘。
    this.version(4).stores({
      meta: 'key',
      settings: 'id',
      modules: 'id, definitionKey, order, enabled, archivedAt',
      tasks:
        'id, moduleId, goalId, projectId, parentTaskId, status, priority, plannedDate, dueDate, updatedAt, deletedAt',
      dailyPlans: 'localDate',
      goals: 'id, moduleId, status, updatedAt, deletedAt',
      projects: 'id, moduleId, goalId, status, updatedAt, deletedAt',
      habits: 'id, moduleId, goalId, startDate, endDate, archivedAt',
      habitCheckins: 'id, habitId, localDate, &[habitId+localDate]',
      activityLogs:
        'id, moduleId, projectId, taskId, kind, localDate, sourceFocusSessionId',
      skillAssessments: 'id, moduleId',
      bodyMeasurements: 'id, moduleId, localDate, &[moduleId+localDate]',
      notes: 'id, moduleId, projectId, goalId, noteType, pinned, archivedAt, updatedAt',
      resources: 'id, moduleId, projectId, resourceType, readStatus, favorite, archivedAt',
      focusSessions: 'id, taskId, moduleId, status, startedAt',
      reviews: 'id, periodType, startDate, endDate, status',
    })

    // 阶段 6 收尾：为「同一 FocusSession 最多转成一条 ActivityLog」加数据库级唯一约束。
    // 未转换的活动记录该字段为 null，不会被索引，因此不影响既有数据。
    this.version(5).stores({
      meta: 'key',
      settings: 'id',
      modules: 'id, definitionKey, order, enabled, archivedAt',
      tasks:
        'id, moduleId, goalId, projectId, parentTaskId, status, priority, plannedDate, dueDate, updatedAt, deletedAt',
      dailyPlans: 'localDate',
      goals: 'id, moduleId, status, updatedAt, deletedAt',
      projects: 'id, moduleId, goalId, status, updatedAt, deletedAt',
      habits: 'id, moduleId, goalId, startDate, endDate, archivedAt',
      habitCheckins: 'id, habitId, localDate, &[habitId+localDate]',
      activityLogs:
        'id, moduleId, projectId, taskId, kind, localDate, &sourceFocusSessionId',
      skillAssessments: 'id, moduleId',
      bodyMeasurements: 'id, moduleId, localDate, &[moduleId+localDate]',
      notes: 'id, moduleId, projectId, goalId, noteType, pinned, archivedAt, updatedAt',
      resources: 'id, moduleId, projectId, resourceType, readStatus, favorite, archivedAt',
      focusSessions: 'id, taskId, moduleId, status, startedAt',
      reviews: 'id, periodType, startDate, endDate, status',
    })

    // 迁移入口：新增持久化表或字段时，追加 this.version(N).stores({...}) 并提供完整 schema，
    // 必要时为旧数据做验证/补齐，禁止通过删库掩盖问题。

    // dataEpoch 跨标签页失效：一旦其他标签页完整替换了数据，本实例的写入将被统一拒绝。
    installEpochWriteGuard(this)
  }
}

const instances = new Map<string, StarDeskDB>()

export function getDb(space: DataSpace): StarDeskDB {
  const name = DB_NAMES[space]
  let db = instances.get(name)
  if (!db) {
    db = new StarDeskDB(name)
    instances.set(name, db)
  }
  return db
}

export const DATA_EPOCH_KEY = 'dataEpoch'

/** 读取（或初始化）dataEpoch，并记录为本标签页认可的 epoch。 */
export async function getDataEpoch(db: StarDeskDB): Promise<string> {
  const row = await db.meta.get(DATA_EPOCH_KEY)
  if (row) {
    setKnownEpoch(db.name, row.value)
    return row.value
  }
  const epoch = crypto.randomUUID()
  await db.meta.put({ key: DATA_EPOCH_KEY, value: epoch })
  setKnownEpoch(db.name, epoch)
  return epoch
}

/**
 * 完整替换恢复后生成新的 dataEpoch，并广播给其他标签页使其失效。
 * 广播使用 BroadcastChannel（不可用时回退 storage 事件）。
 */
export async function renewDataEpoch(db: StarDeskDB): Promise<string> {
  const epoch = crypto.randomUUID()
  await db.meta.put({ key: DATA_EPOCH_KEY, value: epoch })
  publishEpochChange(db.name, epoch)
  return epoch
}
