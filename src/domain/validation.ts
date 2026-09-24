/**
 * 表单与数据校验（Zod）。
 * 覆盖需求第八节「必须验证的约束」中的字段级规则。
 */

import { z } from 'zod'
import { isValidLocalDate } from '@/lib/date'

/** 标题：去除前后空格后不能为空，最多 120 字。 */
export function titleSchema(max = 120) {
  return z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(max, `标题最多 ${max} 字`)
}

export function optionalText(max = 2000) {
  return z
    .string()
    .trim()
    .max(max, `最多 ${max} 字`)
    .optional()
    .or(z.literal(''))
}

/** 纯日期 YYYY-MM-DD，可空。 */
export function optionalDateSchema() {
  return z
    .string()
    .trim()
    .refine((v) => v === '' || isValidLocalDate(v), '日期格式应为 YYYY-MM-DD')
    .optional()
    .or(z.literal(''))
    .or(z.null())
}

/**
 * 时间 HH:mm，可空。
 * 必须接受 null：表单/实体统一用 null 表示「未填写」，
 * 之前只接受 undefined 与 ''，导致任务表单保存被静默拒绝。
 */
export const optionalTimeSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), '时间格式应为 HH:mm')
  .optional()
  .or(z.literal(''))
  .or(z.null())

/** 分钟数：非负有限数字，可空（缺失不转零）。 */
export const optionalMinutesSchema = z
  .number()
  .finite('时长须为有效数字')
  .nonnegative('时长不能为负')
  .nullish()
  .or(z.undefined())

/** 百分比 0-100。 */
export const percentSchema = z.number().finite().min(0).max(100)

/** 技能等级 1-5。 */
export const levelSchema = z.number().int().min(1).max(5)

/** 仅允许 http/https 协议的安全链接。 */
export function isSafeUrl(value: string): boolean {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const safeUrlSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || isSafeUrl(v), '链接只支持 http 或 https 协议')

export const tagsSchema = z.array(z.string().trim().min(1)).max(20).default([])

/** 权重须为正有限数字。 */
export const positiveWeightSchema = z
  .number()
  .finite()
  .positive('体重大于 0')
  .nullish()

// ---------------- 实体输入 ----------------

export const taskInputSchema = z.object({
  title: titleSchema(),
  description: optionalText(4000),
  moduleId: z.string().nullish(),
  goalId: z.string().nullish(),
  projectId: z.string().nullish(),
  parentTaskId: z.string().nullish(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  priority: z.enum(['high', 'medium', 'low']),
  plannedDate: optionalDateSchema(),
  scheduledTime: optionalTimeSchema,
  dueDate: optionalDateSchema(),
  estimatedMinutes: optionalMinutesSchema,
  tags: tagsSchema,
})

export type TaskInput = z.infer<typeof taskInputSchema>

export const goalInputSchema = z.object({
  title: titleSchema(),
  description: optionalText(4000),
  moduleId: z.string().min(1),
  startDate: optionalDateSchema(),
  targetDate: optionalDateSchema(),
  status: z.enum(['not_started', 'in_progress', 'done', 'archived']),
  progressMode: z.enum(['auto', 'manual']),
  manualProgress: percentSchema.nullish(),
})

export type GoalInput = z.infer<typeof goalInputSchema>

export const projectInputSchema = z.object({
  title: titleSchema(),
  description: optionalText(4000),
  moduleId: z.string().min(1),
  goalId: z.string().nullish(),
  projectType: z.string().trim().max(40).optional().or(z.literal('')),
  startDate: optionalDateSchema(),
  targetDate: optionalDateSchema(),
  status: z.enum(['active', 'on_hold', 'done', 'archived']),
  weeklyTargetMinutes: optionalMinutesSchema,
})

export type ProjectInput = z.infer<typeof projectInputSchema>

/** 活动记录的类型化 details（按 kind 匹配一个键，拒绝任意 JSON）。 */
export const activityDetailsSchema = z.object({
  learning: z
    .object({
      topic: z.string().max(200).optional(),
      takeaway: z.string().max(2000).optional(),
      resourceIds: z.array(z.string()).max(20).optional(),
    })
    .optional(),
  hobby: z
    .object({
      content: z.string().max(500).optional(),
      workLink: z.string().max(500).optional(),
    })
    .optional(),
  workout: z
    .object({
      workoutType: z.enum([
        'strength',
        'running',
        'cycling',
        'swimming',
        'yoga',
        'walking',
        'other',
      ]).optional(),
      intensity: z.number().int().min(1).max(5).optional(),
      distanceKm: z.number().positive().optional(),
    })
    .optional(),
})

export const activityInputSchema = z.object({
  kind: z.enum(['learning', 'hobby', 'workout', 'generic']),
  moduleId: z.string().min(1),
  projectId: z.string().nullish(),
  taskId: z.string().nullish(),
  localDate: z.string().refine((v) => isValidLocalDate(v), '日期格式应为 YYYY-MM-DD'),
  title: titleSchema(),
  durationMinutes: optionalMinutesSchema,
  note: optionalText(4000),
  details: activityDetailsSchema.default({}),
})

export type ActivityInput = z.infer<typeof activityInputSchema>
