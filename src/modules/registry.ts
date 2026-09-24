/**
 * 模块注册表（开发层）。定义代码中的模块能力与内置模块。
 *
 * - ModuleDefinition 只存在代码里；用户可编辑的 ModuleConfig 存在数据库里。
 * - 导航、领域列表、首页卡片统一读取同一份定义 + 数据库配置，
 *   不在多处手写内置模块名单。
 * - React 组件/函数不可序列化进数据库或备份。
 */

import type { ComponentType } from 'react'
import {
  Sprout,
  Briefcase,
  Palette,
  Dumbbell,
  Layers,
  Plane,
  Wallet,
  BookOpen,
  Star,
  Heart,
  Target,
  Compass,
  Leaf,
  Pencil,
  Coffee,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleCapability } from '@/domain/enums'

export interface ModuleDefinition {
  key: string
  defaultName: string
  defaultDescription: string
  iconKey: string
  defaultColorKey: string
  capabilities: ModuleCapability[]
  builtin: boolean
}

/** 图标白名单：iconKey 必须在此映射内，用户文本不直接当类名/组件路径执行。 */
export const ICON_MAP: Record<string, LucideIcon> = {
  sprout: Sprout,
  briefcase: Briefcase,
  palette: Palette,
  dumbbell: Dumbbell,
  layers: Layers,
  plane: Plane,
  wallet: Wallet,
  book: BookOpen,
  star: Star,
  heart: Heart,
  target: Target,
  compass: Compass,
  leaf: Leaf,
  pencil: Pencil,
  coffee: Coffee,
}

export const ICON_KEYS = Object.keys(ICON_MAP)

export function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Layers
}

/** 颜色白名单（预设色板）。colorKey 必须在此映射内。 */
export const COLOR_MAP: Record<string, string> = {
  growth: '#4D9FFF', // 青蓝
  career: '#8C9BFF', // 靛蓝
  hobbies: '#F2B35D', // 琥珀
  fitness: '#4AD9A9', // 薄荷绿
  travel: '#5DE4F5',
  finance: '#F2C46D',
  life: '#FF9FB2',
  study: '#B48CFF',
  other: '#A7B7CD',
}

export const COLOR_KEYS = Object.keys(COLOR_MAP)

export function getColor(key: string): string {
  return COLOR_MAP[key] ?? COLOR_MAP.other
}

const ALL_CAPABILITIES: ModuleCapability[] = [
  'goals',
  'projects',
  'tasks',
  'habits',
  'notes',
  'activities',
]

/** 四个内置领域模块定义。 */
export const BUILTIN_MODULES: ModuleDefinition[] = [
  {
    key: 'growth',
    defaultName: '个人提升',
    defaultDescription: '把学习方向变成可执行的学习计划，并沉淀所学内容。',
    iconKey: 'sprout',
    defaultColorKey: 'growth',
    capabilities: ALL_CAPABILITIES,
    builtin: true,
  },
  {
    key: 'career',
    defaultName: '职业规划',
    defaultDescription: '明确方向、看见能力差距、持续积累可以展示的成果。',
    iconKey: 'briefcase',
    defaultColorKey: 'career',
    capabilities: ALL_CAPABILITIES,
    builtin: true,
  },
  {
    key: 'hobbies',
    defaultName: '兴趣爱好',
    defaultDescription: '持续投入喜欢的事，并保存体验和作品。',
    iconKey: 'palette',
    defaultColorKey: 'hobbies',
    capabilities: ALL_CAPABILITIES,
    builtin: true,
  },
  {
    key: 'fitness',
    defaultName: '运动健身',
    defaultDescription: '管理训练安排、记录实际完成的运动、观察个人趋势。',
    iconKey: 'dumbbell',
    defaultColorKey: 'fitness',
    capabilities: ALL_CAPABILITIES,
    builtin: true,
  },
]

/** 自定义模块使用的通用定义模板。 */
export const GENERIC_DEFINITION: ModuleDefinition = {
  key: 'generic',
  defaultName: '新模块',
  defaultDescription: '',
  iconKey: 'layers',
  defaultColorKey: 'other',
  capabilities: ALL_CAPABILITIES,
  builtin: false,
}

export function getDefinition(key: string): ModuleDefinition | undefined {
  return BUILTIN_MODULES.find((m) => m.key === key)
}

/** 模块概览组件契约（后续领域阶段实现专属概览）。 */
export interface ModuleOverviewProps {
  moduleId: string
}

export type ModuleOverviewComponent = ComponentType<ModuleOverviewProps>
