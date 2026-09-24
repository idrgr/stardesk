/**
 * 核心实体类型（最低契约，见需求文档第八节）。
 *
 * 通用约定：
 * - id / createdAt / updatedAt / revision 为所有持久化实体共有。
 * - deletedAt 可空，表示进入回收站；deleteBatchId 关联同一次软删除。
 * - archivedAt 仅对支持「归档」语义的实体存在。
 * - 可选字段一律使用 `?` 或显式 null，避免 undefined / null / 空字符串混用。
 */

import type {
  ActivityKind,
  FocusStatus,
  GoalStatus,
  ModuleCapability,
  NoteType,
  ProgressMode,
  ProjectStatus,
  ReadStatus,
  ResourceType,
  ReviewPeriod,
  ReviewStatus,
  TaskPriority,
  TaskStatus,
  Theme,
  Density,
  WorkoutType,
} from './enums'

export interface BaseEntity {
  id: string
  createdAt: string // UTC ISO
  updatedAt: string // UTC ISO
  revision: number
  deletedAt: string | null
  deleteBatchId: string | null
}

export interface ModuleConfig extends BaseEntity {
  definitionKey: string
  name: string
  description: string
  iconKey: string
  colorKey: string
  order: number
  enabled: boolean
  capabilities: ModuleCapability[]
  archivedAt: string | null
}

export interface Task extends BaseEntity {
  moduleId: string | null
  goalId: string | null
  projectId: string | null
  parentTaskId: string | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  plannedDate: string | null // YYYY-MM-DD
  scheduledTime: string | null // HH:mm
  dueDate: string | null // YYYY-MM-DD
  estimatedMinutes: number | null
  tags: string[]
  completedAt: string | null // UTC ISO
  completedLocalDate: string | null // YYYY-MM-DD
  archivedAt: string | null // 归档（仅影响默认视图）
}

export interface DailyPlan {
  localDate: string
  orderedTaskIds: string[]
  topTaskIds: string[]
}

export interface Goal extends BaseEntity {
  moduleId: string
  title: string
  description: string
  startDate: string | null
  targetDate: string | null
  status: GoalStatus
  progressMode: ProgressMode
  manualProgress: number | null // 0-100，仅手动模式
}

export interface Project extends BaseEntity {
  moduleId: string
  goalId: string | null
  title: string
  description: string
  projectType: string
  startDate: string | null
  targetDate: string | null
  status: ProjectStatus
  weeklyTargetMinutes: number | null
}

export interface HabitFrequency {
  cadence: 'daily' | 'weekly'
  daysOfWeek: number[] // 0-6，weekly 时有效
}

export interface HabitScheduleVersion {
  effectiveFrom: string // YYYY-MM-DD，该频率版本生效日
  frequency: HabitFrequency
}

export interface PauseInterval {
  start: string // YYYY-MM-DD
  end: string | null
}

export interface Habit extends BaseEntity {
  moduleId: string
  goalId: string | null
  title: string
  description: string
  enabled: boolean
  startDate: string
  endDate: string | null
  scheduleVersions: HabitScheduleVersion[]
  pauseIntervals: PauseInterval[]
  archivedAt: string | null
}

export interface HabitCheckin {
  id: string
  habitId: string
  localDate: string
  note: string
  createdAt: string
}

export interface FocusSession extends BaseEntity {
  taskId: string | null
  moduleId: string | null
  status: FocusStatus
  plannedSeconds: number
  startedAt: string // UTC ISO
  targetEndAt: string | null // UTC ISO
  activeSegmentStartedAt: string | null // UTC ISO
  pausedAt: string | null
  accumulatedActiveSeconds: number
  endedAt: string | null
  actualSeconds: number | null
  localDate: string | null // YYYY-MM-DD，统计日期
  note: string
}

export interface LearningDetails {
  topic?: string
  takeaway?: string
  resourceIds?: string[]
}
export interface HobbyDetails {
  content?: string
  workLink?: string
}
export interface WorkoutDetails {
  workoutType?: WorkoutType
  intensity?: number // 1-5 主观强度
  distanceKm?: number
}
/** details 为有类型的联合结构，按 kind 匹配其中一个键；禁止任意 JSON。 */
export interface ActivityDetails {
  learning?: LearningDetails
  hobby?: HobbyDetails
  workout?: WorkoutDetails
}

export interface ActivityLog extends BaseEntity {
  moduleId: string
  projectId: string | null
  taskId: string | null
  kind: ActivityKind
  localDate: string
  title: string
  durationMinutes: number | null
  note: string
  sourceFocusSessionId: string | null
  details: ActivityDetails
}

export interface SkillAssessment extends BaseEntity {
  moduleId: string
  name: string
  currentLevel: number // 1-5
  targetLevel: number // 1-5
  description: string
  evidenceUrls: string[]
  learningProjectId: string | null
}

export interface BodyMeasurement extends BaseEntity {
  moduleId: string
  localDate: string
  weightKg: number | null
  note: string
}

export interface Note extends BaseEntity {
  moduleId: string | null
  projectId: string | null
  goalId: string | null
  title: string
  bodyMarkdown: string
  noteType: NoteType
  tags: string[]
  pinned: boolean
  archivedAt: string | null
}

export interface Resource extends BaseEntity {
  moduleId: string | null
  projectId: string | null
  title: string
  url: string
  resourceType: ResourceType
  description: string
  tags: string[]
  readStatus: ReadStatus
  favorite: boolean
  archivedAt: string | null
}

export interface ReviewNextAction {
  title: string
  plannedDate: string
  moduleId: string | null
}

/** 复盘统计快照（纯数字，可序列化）。 */
export interface ReviewStats {
  tasksCompleted: number
  learningMinutes: number
  hobbyMinutes: number
  workoutMinutes: number
  habitOpportunities: number
  habitCompleted: number
}

export interface Review extends BaseEntity {
  periodType: ReviewPeriod
  startDate: string
  endDate: string
  status: ReviewStatus
  answers: Record<string, string> // questionKey -> 回答文本
  statsSnapshot: ReviewStats | null
  snapshotAt: string | null
  nextActions: ReviewNextAction[]
  convertedTaskIds: string[]
}

export interface FocusPreferences {
  defaultMinutes: number
  presets: number[]
}

export interface DashboardComponentConfig {
  id: string
  visible: boolean
}

export interface UserSettings {
  id: 'settings'
  nickname: string
  workspaceName: string
  theme: Theme
  density: Density
  timeZone: string
  weekStartsOn: number // 0=周日 … 6=周六
  focusPreferences: FocusPreferences
  dashboardLayout: DashboardComponentConfig[]
  onboardingCompleted: boolean
  lastExportInitiatedAt: string | null
}
