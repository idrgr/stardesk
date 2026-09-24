import type { BaseEntity } from '@/domain/entities'
import { newId, nowIso } from '@/lib/id'

/** 生成新实体的通用基础字段。 */
export function newBase(): Pick<
  BaseEntity,
  'id' | 'createdAt' | 'updatedAt' | 'revision' | 'deletedAt' | 'deleteBatchId'
> {
  const now = nowIso()
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
  }
}

/** 每次有效修改递增 revision，并刷新 updatedAt。 */
export function bump<T extends BaseEntity>(entity: T): T {
  return {
    ...entity,
    updatedAt: nowIso(),
    revision: (entity.revision ?? 0) + 1,
  }
}

/** 编辑冲突错误（多标签页陈旧版本）。 */
export class RevisionConflictError extends Error {
  constructor(public readonly entityId: string) {
    super(`编辑冲突：${entityId} 已被其他页面修改`)
    this.name = 'RevisionConflictError'
  }
}

/** 空字符串 → null，用于把表单里的空值规范化到实体。 */
export function emptyToNull<T extends string | null | undefined>(
  v: T,
): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t === '' ? null : t
}
