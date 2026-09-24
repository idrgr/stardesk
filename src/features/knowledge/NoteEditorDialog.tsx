import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listProjects } from '@/data/repositories/projects'
import { createNote, updateNote } from '@/data/repositories/notes'
import { NOTE_TYPE_LABEL, type NoteType } from '@/domain/enums'
import type { Note } from '@/domain/entities'
import { cn } from '@/lib/cn'

interface FormState {
  title: string
  bodyMarkdown: string
  moduleId: string
  projectId: string
  noteType: NoteType
  tags: string
}

function emptyForm(moduleId = '', projectId = ''): FormState {
  return { title: '', bodyMarkdown: '', moduleId, projectId, noteType: 'note', tags: '' }
}

function toForm(n: Note): FormState {
  return {
    title: n.title,
    bodyMarkdown: n.bodyMarkdown,
    moduleId: n.moduleId ?? '',
    projectId: n.projectId ?? '',
    noteType: n.noteType,
    tags: n.tags.join(', '),
  }
}

export function NoteEditorDialog({
  open,
  onClose,
  note,
  defaultModuleId,
  defaultProjectId,
  defaultNoteType,
}: {
  open: boolean
  onClose: () => void
  note?: Note | null
  defaultModuleId?: string
  defaultProjectId?: string
  defaultNoteType?: NoteType
}) {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []

  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      note
        ? toForm(note)
        : emptyForm(defaultModuleId, defaultProjectId ?? ''),
    )
    if (!note && defaultNoteType) setForm((f) => ({ ...f, noteType: defaultNoteType }))
    setError(null)
    setSaving(false)
    setPreview(false)
  }, [open, note, defaultModuleId, defaultProjectId, defaultNoteType])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const moduleProjects = useMemo(() => projects.filter((p) => !form.moduleId || p.moduleId === form.moduleId), [projects, form.moduleId])

  const submit = async () => {
    setSaving(true)
    setError(null)
    const title = form.title.trim()
    if (!title) {
      setError('标题不能为空')
      setSaving(false)
      return
    }
    const tags = form.tags.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean)
    try {
      if (note) {
        await updateNote(db, note.id, { title, bodyMarkdown: form.bodyMarkdown, moduleId: form.moduleId || null, projectId: form.projectId || null, noteType: form.noteType, tags })
        toast('笔记已保存', 'success')
      } else {
        await createNote(db, { title, bodyMarkdown: form.bodyMarkdown, moduleId: form.moduleId || null, projectId: form.projectId || null, noteType: form.noteType, tags })
        toast('笔记已创建', 'success')
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title={note ? '编辑笔记' : '新增笔记'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="标题" error={error ?? undefined}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="笔记标题" maxLength={120} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="所属领域">
            <Select value={form.moduleId} onChange={(e) => set('moduleId', e.target.value)}>
              <option value="">无</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="所属项目">
            <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">无</option>
              {moduleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <Select value={form.noteType} onChange={(e) => set('noteType', e.target.value as NoteType)}>
              {(Object.keys(NOTE_TYPE_LABEL) as NoteType[]).map((t) => (
                <option key={t} value={t}>{NOTE_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="标签（逗号分隔）">
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="成长, 学习" />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-secondary">正文（Markdown）</span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className={cn('flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors', preview ? 'bg-accent/10 text-accent' : 'text-foreground-secondary hover:text-foreground')}
            >
              {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {preview ? '编辑' : '预览'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-40 rounded-lg border border-border bg-surface px-3 py-2">
              {form.bodyMarkdown.trim() ? (
                <div className="prose-sm prose-invert max-w-none text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.bodyMarkdown}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">（暂无内容）</p>
              )}
            </div>
          ) : (
            <Textarea value={form.bodyMarkdown} onChange={(e) => set('bodyMarkdown', e.target.value)} placeholder="用 Markdown 记录内容…" className="min-h-40" />
          )}
        </div>
      </div>
    </Dialog>
  )
}
