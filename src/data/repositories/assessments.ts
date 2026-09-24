import type { StarDeskDB } from '@/data/db/db'
import type { BodyMeasurement, SkillAssessment } from '@/domain/entities'
import { nowIso } from '@/lib/id'
import { newBase, bump } from './base'

// ---------------- 技能自评 ----------------

export interface NewSkillInput {
  moduleId: string
  name: string
  currentLevel: number
  targetLevel: number
  description?: string
  evidenceUrls?: string[]
  learningProjectId?: string | null
}

export async function createSkill(db: StarDeskDB, input: NewSkillInput): Promise<SkillAssessment> {
  const skill: SkillAssessment = {
    ...newBase(),
    moduleId: input.moduleId,
    name: input.name.trim(),
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    description: (input.description ?? '').trim(),
    evidenceUrls: (input.evidenceUrls ?? []).map((u) => u.trim()).filter(Boolean),
    learningProjectId: input.learningProjectId ?? null,
  }
  await db.skillAssessments.add(skill)
  return skill
}

export async function updateSkill(
  db: StarDeskDB,
  id: string,
  patch: Partial<Pick<SkillAssessment, 'name' | 'currentLevel' | 'targetLevel' | 'description' | 'evidenceUrls' | 'learningProjectId'>>,
): Promise<SkillAssessment> {
  return db.transaction('rw', db.skillAssessments, async () => {
    const existing = await db.skillAssessments.get(id)
    if (!existing) throw new Error('技能项不存在')
    const merged = bump({ ...existing, ...patch, name: patch.name != null ? patch.name.trim() : existing.name })
    await db.skillAssessments.put(merged)
    return merged
  })
}

export async function listSkills(db: StarDeskDB, moduleId?: string): Promise<SkillAssessment[]> {
  let list = await db.skillAssessments.toArray()
  list = list.filter((s) => !s.deletedAt)
  if (moduleId) list = list.filter((s) => s.moduleId === moduleId)
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function softDeleteSkills(db: StarDeskDB, ids: string[]): Promise<number> {
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.skillAssessments, async () => {
    const skills = await db.skillAssessments.bulkGet(ids)
    for (const s of skills) {
      if (!s || s.deletedAt) continue
      await db.skillAssessments.put({ ...s, deletedAt: now, deleteBatchId: crypto.randomUUID(), updatedAt: now, revision: (s.revision ?? 0) + 1 })
      count++
    }
  })
  return count
}

/** 能力差距 = 目标等级 - 当前等级，下限为零。 */
export function skillGap(skill: SkillAssessment): number {
  return Math.max(0, skill.targetLevel - skill.currentLevel)
}

// ---------------- 体重记录 ----------------

export async function upsertBodyMeasurement(
  db: StarDeskDB,
  input: { moduleId: string; localDate: string; weightKg: number | null; note?: string },
): Promise<BodyMeasurement> {
  return db.transaction('rw', db.bodyMeasurements, async () => {
    const existing = await db.bodyMeasurements
      .where('[moduleId+localDate]')
      .equals([input.moduleId, input.localDate])
      .first()
    if (existing) {
      const merged = bump({ ...existing, weightKg: input.weightKg, note: (input.note ?? '').trim() })
      await db.bodyMeasurements.put(merged)
      return merged
    }
    const record: BodyMeasurement = {
      ...newBase(),
      moduleId: input.moduleId,
      localDate: input.localDate,
      weightKg: input.weightKg,
      note: (input.note ?? '').trim(),
    }
    await db.bodyMeasurements.add(record)
    return record
  })
}

export async function listBodyMeasurements(db: StarDeskDB, moduleId?: string): Promise<BodyMeasurement[]> {
  let list = await db.bodyMeasurements.toArray()
  list = list.filter((b) => !b.deletedAt)
  if (moduleId) list = list.filter((b) => b.moduleId === moduleId)
  return list.sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
}
