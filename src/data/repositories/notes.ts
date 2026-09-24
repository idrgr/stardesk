import type { StarDeskDB } from '@/data/db/db'
import type { Note } from '@/domain/entities'
import type { NoteType } from '@/domain/enums'
import { nowIso } from '@/lib/id'
import { newBase, bump, emptyToNull } from './base'

export interface NewNoteInput {
  title: string
  bodyMarkdown?: string
  moduleId?: string | null
  projectId?: string | null
  goalId?: string | null
  noteType?: NoteType
  tags?: string[]
}

export async function createNote(db: StarDeskDB, input: NewNoteInput): Promise<Note> {
  const note: Note = {
    ...newBase(),
    moduleId: emptyToNull(input.moduleId),
    projectId: emptyToNull(input.projectId),
    goalId: emptyToNull(input.goalId),
    title: input.title.trim(),
    bodyMarkdown: (input.bodyMarkdown ?? '').trim(),
    noteType: input.noteType ?? 'note',
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    pinned: false,
    archivedAt: null,
  }
  await db.notes.add(note)
  return note
}

export type NotePatch = Partial<
  Pick<Note, 'title' | 'bodyMarkdown' | 'moduleId' | 'projectId' | 'goalId' | 'noteType' | 'tags' | 'pinned'>
>

export async function updateNote(db: StarDeskDB, id: string, patch: NotePatch): Promise<Note> {
  return db.transaction('rw', db.notes, async () => {
    const existing = await db.notes.get(id)
    if (!existing) throw new Error('笔记不存在')
    const merged = bump({
      ...existing,
      ...patch,
      title: patch.title != null ? patch.title.trim() : existing.title,
      tags: patch.tags ? patch.tags.map((t) => t.trim()).filter(Boolean) : existing.tags,
    })
    await db.notes.put(merged)
    return merged
  })
}

export async function getNote(db: StarDeskDB, id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

export interface NoteFilter {
  keyword?: string
  moduleId?: string
  noteType?: NoteType
  includeArchived?: boolean
}

export async function queryNotes(db: StarDeskDB, filter: NoteFilter = {}): Promise<Note[]> {
  let list = await db.notes.toArray()
  list = list.filter((n) => !n.deletedAt)
  if (!filter.includeArchived) list = list.filter((n) => !n.archivedAt)
  if (filter.moduleId) list = list.filter((n) => n.moduleId === filter.moduleId)
  if (filter.noteType) list = list.filter((n) => n.noteType === filter.noteType)
  if (filter.keyword) {
    const kw = filter.keyword.trim().toLowerCase()
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) ||
        n.bodyMarkdown.toLowerCase().includes(kw) ||
        n.tags.some((t) => t.toLowerCase().includes(kw)),
    )
  }
  list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return list
}

export async function toggleNotePin(db: StarDeskDB, id: string): Promise<Note> {
  return db.transaction('rw', db.notes, async () => {
    const existing = await db.notes.get(id)
    if (!existing) throw new Error('笔记不存在')
    const merged = bump({ ...existing, pinned: !existing.pinned })
    await db.notes.put(merged)
    return merged
  })
}

export async function archiveNotes(db: StarDeskDB, ids: string[]): Promise<number> {
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.notes, async () => {
    const notes = await db.notes.bulkGet(ids)
    for (const n of notes) {
      if (!n || n.archivedAt) continue
      await db.notes.put({ ...n, archivedAt: now, updatedAt: now, revision: (n.revision ?? 0) + 1 })
      count++
    }
  })
  return count
}

export async function softDeleteNotes(db: StarDeskDB, ids: string[]): Promise<number> {
  const now = nowIso()
  let count = 0
  await db.transaction('rw', db.notes, async () => {
    const notes = await db.notes.bulkGet(ids)
    for (const n of notes) {
      if (!n || n.deletedAt) continue
      await db.notes.put({ ...n, deletedAt: now, deleteBatchId: crypto.randomUUID(), updatedAt: now, revision: (n.revision ?? 0) + 1 })
      count++
    }
  })
  return count
}
