/**
 * 稳定枚举值。数据层保存英文值，界面通过映射显示中文。
 */

export const TaskStatus = {
  todo: 'todo',
  in_progress: 'in_progress',
  done: 'done',
  cancelled: 'cancelled',
} as const
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
}

export const TaskPriority = {
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority]

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const GoalStatus = {
  not_started: 'not_started',
  in_progress: 'in_progress',
  done: 'done',
  archived: 'archived',
} as const
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus]

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  done: '已完成',
  archived: '已归档',
}

export const ProgressMode = {
  auto: 'auto',
  manual: 'manual',
} as const
export type ProgressMode = (typeof ProgressMode)[keyof typeof ProgressMode]

export const ProjectStatus = {
  active: 'active',
  on_hold: 'on_hold',
  done: 'done',
  archived: 'archived',
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '进行中',
  on_hold: '暂停',
  done: '已完成',
  archived: '已归档',
}

export const ActivityKind = {
  learning: 'learning',
  hobby: 'hobby',
  workout: 'workout',
  generic: 'generic',
} as const
export type ActivityKind = (typeof ActivityKind)[keyof typeof ActivityKind]

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  learning: '学习',
  hobby: '兴趣',
  workout: '运动',
  generic: '活动',
}

export const NoteType = {
  note: 'note',
  achievement: 'achievement', // 职业成果
  work: 'work', // 兴趣作品
} as const
export type NoteType = (typeof NoteType)[keyof typeof NoteType]

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  note: '笔记',
  achievement: '职业成果',
  work: '作品',
}

export const ResourceType = {
  article: 'article',
  video: 'video',
  course: 'course',
  book: 'book',
  other: 'other',
} as const
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType]

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  article: '文章',
  video: '视频',
  course: '课程',
  book: '书籍',
  other: '其他',
}

export const ReadStatus = {
  pending: 'pending', // 待查看
  read: 'read', // 已查看
} as const
export type ReadStatus = (typeof ReadStatus)[keyof typeof ReadStatus]

export const READ_STATUS_LABEL: Record<ReadStatus, string> = {
  pending: '待查看',
  read: '已查看',
}

export const WorkoutType = {
  strength: 'strength',
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  yoga: 'yoga',
  walking: 'walking',
  other: 'other',
} as const
export type WorkoutType = (typeof WorkoutType)[keyof typeof WorkoutType]

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  strength: '力量',
  running: '跑步',
  cycling: '骑行',
  swimming: '游泳',
  yoga: '瑜伽',
  walking: '步行',
  other: '其他',
}

export const ReviewPeriod = {
  week: 'week',
  month: 'month',
} as const
export type ReviewPeriod = (typeof ReviewPeriod)[keyof typeof ReviewPeriod]

export const ReviewStatus = {
  draft: 'draft',
  done: 'done',
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const ModuleCapability = {
  goals: 'goals',
  projects: 'projects',
  tasks: 'tasks',
  habits: 'habits',
  notes: 'notes',
  activities: 'activities',
} as const
export type ModuleCapability = (typeof ModuleCapability)[keyof typeof ModuleCapability]

export const MODULE_CAPABILITY_LABEL: Record<ModuleCapability, string> = {
  goals: '目标',
  projects: '项目',
  tasks: '任务',
  habits: '习惯',
  notes: '笔记',
  activities: '活动记录',
}

export const FocusStatus = {
  running: 'running',
  paused: 'paused',
  pending_confirm: 'pending_confirm', // 倒计时结束待确认
  done: 'done',
  abandoned: 'abandoned',
  restore_pending: 'restore_pending', // 恢复导入后的进行中会话
} as const
export type FocusStatus = (typeof FocusStatus)[keyof typeof FocusStatus]

export const Theme = {
  dark: 'dark',
  light: 'light',
  system: 'system',
} as const
export type Theme = (typeof Theme)[keyof typeof Theme]

export const Density = {
  comfortable: 'comfortable',
  compact: 'compact',
} as const
export type Density = (typeof Density)[keyof typeof Density]
