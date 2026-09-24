/**
 * 模块配置仓储：读取/写入数据库中的 ModuleConfig，并负责首次种子化内置模块。
 */

import type { StarDeskDB } from '@/data/db/db'
import type { ModuleConfig } from '@/domain/entities'
import { BUILTIN_MODULES, GENERIC_DEFINITION } from '@/modules/registry'
import { newBase, bump, emptyToNull } from './base'

/** 幂等种子化四个内置模块（刷新/重复执行/StrictMode 双调用均不重复插入）。 */
export async function ensureBuiltinModules(db: StarDeskDB): Promise<ModuleConfig[]> {
  return db.transaction('rw', db.modules, async () => {
    const existing = await db.modules.toArray()
    const toAdd = BUILTIN_MODULES.filter(
      (def) => !existing.some((m) => m.definitionKey === def.key),
    )
    if (toAdd.length === 0) return existing

    const maxOrder = existing.reduce((acc, m) => Math.max(acc, m.order), -1)
    const created: ModuleConfig[] = []
    for (let i = 0; i < toAdd.length; i++) {
      const def = toAdd[i]
      const cfg: ModuleConfig = {
        ...newBase(),
        definitionKey: def.key,
        name: def.defaultName,
        description: def.defaultDescription,
        iconKey: def.iconKey,
        colorKey: def.defaultColorKey,
        order: maxOrder + 1 + i,
        enabled: true,
        capabilities: [...def.capabilities],
        archivedAt: null,
      }
      await db.modules.add(cfg)
      created.push(cfg)
    }
    return [...existing, ...created]
  })
}

export async function listModules(db: StarDeskDB): Promise<ModuleConfig[]> {
  const all = await db.modules.toArray()
  return all.sort((a, b) => a.order - b.order)
}

export async function listEnabledModules(db: StarDeskDB): Promise<ModuleConfig[]> {
  const all = await listModules(db)
  return all.filter((m) => m.enabled && !m.archivedAt)
}

export async function getModule(db: StarDeskDB, id: string): Promise<ModuleConfig | undefined> {
  return db.modules.get(id)
}

export interface ModulePatch {
  name?: string
  description?: string
  iconKey?: string
  colorKey?: string
  order?: number
  enabled?: boolean
  capabilities?: ModuleConfig['capabilities']
  archivedAt?: string | null
}

export async function updateModule(db: StarDeskDB, id: string, patch: ModulePatch): Promise<ModuleConfig> {
  return db.transaction('rw', db.modules, async () => {
    const existing = await db.modules.get(id)
    if (!existing) throw new Error('模块不存在')
    const merged = bump({
      ...existing,
      ...patch,
      name: patch.name != null ? patch.name.trim() : existing.name,
      description: patch.description != null ? patch.description.trim() : existing.description,
    })
    if (!merged.name) throw new Error('模块名称不能为空')
    await db.modules.put(merged)
    return merged
  })
}

export interface NewModuleInput {
  name: string
  description?: string
  iconKey?: string
  colorKey?: string
  capabilities?: ModuleConfig['capabilities']
}

/** 创建普通自定义模块（使用 generic 定义 + 新的稳定 ModuleConfig ID）。 */
export async function createModule(db: StarDeskDB, input: NewModuleInput): Promise<ModuleConfig> {
  const all = await listModules(db)
  const maxOrder = all.reduce((acc, m) => Math.max(acc, m.order), -1)
  const cfg: ModuleConfig = {
    ...newBase(),
    definitionKey: GENERIC_DEFINITION.key,
    name: input.name.trim(),
    description: emptyToNull(input.description) ?? '',
    iconKey: input.iconKey ?? GENERIC_DEFINITION.iconKey,
    colorKey: input.colorKey ?? GENERIC_DEFINITION.defaultColorKey,
    order: maxOrder + 1,
    enabled: true,
    capabilities: input.capabilities ?? [...GENERIC_DEFINITION.capabilities],
    archivedAt: null,
  }
  if (!cfg.name) throw new Error('模块名称不能为空')
  await db.modules.add(cfg)
  return cfg
}
