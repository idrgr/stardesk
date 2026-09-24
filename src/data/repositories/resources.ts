import type { StarDeskDB } from '@/data/db/db'
import type { Resource } from '@/domain/entities'
import type { ResourceType, ReadStatus } from '@/domain/enums'
import { nowIso } from '@/lib/id'
import { newBase, bump, emptyToNull } from './base'

export interface NewResourceInput {
  title: string
  url: string
  resourceType?: ResourceType
  description?: string
  moduleId?: string | null
  projectId?: string | null
  tags?: string[]
  favorite?: boolean
}

export async function createResource(db: StarDeskDB, input: NewResourceInput): Promise<Resource> {
  const resource: Resource = {
    ...newBase(),
    moduleId: emptyToNull(input.moduleId),
    projectId: emptyToNull(input.projectId),
    title: input.title.trim(),
    url: input.url.trim(),
    resourceType: input.resourceType ?? 'other',
    description: (input.description ?? '').trim(),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    readStatus: 'pending',
    favorite: input.favorite ?? false,
    archivedAt: null,
  }
  await db.resources.add(resource)
  return resource
}

export type ResourcePatch = Partial<
  Pick<Resource, 'title' | 'url' | 'resourceType' | 'description' | 'moduleId' | 'projectId' | 'tags' | 'readStatus' | 'favorite'>
>

export async function updateResource(db: StarDeskDB, id: string, patch: ResourcePatch): Promise<Resource> {
  return db.transaction('rw', db.resources, async () => {
    const existing = await db.resources.get(id)
    if (!existing) throw new Error('资源不存在')
    const merged = bump({
      ...existing,
      ...patch,
      title: patch.title != null ? patch.title.trim() : existing.title,
      url: patch.url != null ? patch.url.trim() : existing.url,
      tags: patch.tags ? patch.tags.map((t) => t.trim()).filter(Boolean) : existing.tags,
    })
    await db.resources.put(merged)
    return merged
  })
}

export interface ResourceFilter {
  keyword?: string
  moduleId?: string
  resourceType?: ResourceType
  readStatus?: ReadStatus
  favorite?: boolean
  includeArchived?: boolean
}

export async function queryResources(db: StarDeskDB, filter: ResourceFilter = {}): Promise<Resource[]> {
  let list = await db.resources.toArray()
  list = list.filter((r) => !r.deletedAt)
  if (!filter.includeArchived) list = list.filter((r) => !r.archivedAt)
  if (filter.moduleId) list = list.filter((r) => r.moduleId === filter.moduleId)
  if (filter.resourceType) list = list.filter((r) => r.resourceType === filter.resourceType)
  if (filter.readStatus) list = list.filter((r) => r.readStatus === filter.readStatus)
  if (filter.favorite) list = list.filter((r) => r.favorite)
  if (filter.keyword) {
    const kw = filter.keyword.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw) ||
        r.tags.some((t) => t.toLowerCase().includes(kw)),
    )
  }
  list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return list
}

export async function archiveResources(db: StarDeskDB, ids: string[]): Promise<number> {
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.resources, async () => {
    const resources = await db.resources.bulkGet(ids)
    for (const r of resources) {
      if (!r || r.archivedAt) continue
      await db.resources.put({ ...r, archivedAt: now, updatedAt: now, revision: (r.revision ?? 0) + 1 })
      count++
    }
  })
  return count
}
