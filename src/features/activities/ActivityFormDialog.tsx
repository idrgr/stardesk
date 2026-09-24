import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listProjects } from '@/data/repositories/projects'
import { createActivity } from '@/data/repositories/activities'
import { completeTask } from '@/data/repositories/tasks'
import { ACTIVITY_KIND_LABEL, WORKOUT_TYPE_LABEL, type ActivityKind, type WorkoutType } from '@/domain/enums'
import { todayInTimeZone } from '@/lib/date'
import { activityInputSchema } from '@/domain/validation'
import type { ActivityLog } from '@/domain/entities'

interface FormState {
  kind: ActivityKind
  moduleId: string
  projectId: string
  localDate: string
  title: string
  durationMinutes: string
  note: string
  workoutType: WorkoutType
  distanceKm: string
  intensity: string
  workLink: string
}

function emptyForm(moduleId: string, kind: ActivityKind): FormState {
  return {
    kind,
    moduleId,
    projectId: '',
    localDate: todayInTimeZone('Asia/Shanghai'),
    title: '',
    durationMinutes: '',
    note: '',
    workoutType: 'other',
    distanceKm: '',
    intensity: '',
    workLink: '',
  }
}

const DEFAULT_KIND: Record<string, ActivityKind> = {
  growth: 'learning',
  hobbies: 'hobby',
  fitness: 'workout',
}

export function ActivityFormDialog({
  open,
  onClose,
  module,
  projectId,
  linkTask,
}: {
  open: boolean
  onClose: () => void
  module: { id: string; name: string; definitionKey: string } | null
  projectId?: string
  linkTask?: { id: string } | null
}) {
  const { db } = useData()
  const { toast } = useToast()
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []

  const [form, setForm] = useState<FormState>(emptyForm(module?.id ?? '', 'generic'))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const kind = module ? (DEFAULT_KIND[module.definitionKey] ?? 'generic') : 'generic'
    setForm({ ...emptyForm(module?.id ?? '', kind), projectId: projectId ?? '' })
    setError(null)
    setSaving(false)
  }, [open, module, projectId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    const details: ActivityLog['details'] = {}
    if (form.kind === 'learning') {
      details.learning = { topic: form.title }
    } else if (form.kind === 'hobby') {
      details.hobby = { content: form.title, workLink: form.workLink || undefined }
    } else if (form.kind === 'workout') {
      details.workout = {
        workoutType: form.workoutType,
        distanceKm: form.distanceKm === '' ? undefined : Number(form.distanceKm),
        intensity: form.intensity === '' ? undefined : Number(form.intensity),
      }
    }

    const parsed = activityInputSchema.safeParse({
      kind: form.kind,
      moduleId: form.moduleId,
      projectId: form.projectId || null,
      localDate: form.localDate,
      title: form.title,
      durationMinutes: form.durationMinutes === '' ? null : Number(form.durationMinutes),
      note: form.note,
      details,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '输入有误')
      setSaving(false)
      return
    }
    try {
      await createActivity(db, { ...parsed.data, taskId: linkTask?.id ?? null })
      if (linkTask) {
        await completeTask(db, linkTask.id, todayInTimeZone('Asia/Shanghai'))
      }
      toast(linkTask ? '记录已保存，任务已完成' : '记录已保存', 'success')
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
      title="新增活动记录"
      width="max-w-xl"
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value as ActivityKind)}>
              {(Object.keys(ACTIVITY_KIND_LABEL) as ActivityKind[]).map((k) => (
                <option key={k} value={k}>{ACTIVITY_KIND_LABEL[k]}</option>
              ))}
            </Select>
          </Field>
          <Field label="日期">
            <Input type="date" value={form.localDate} onChange={(e) => set('localDate', e.target.value)} />
          </Field>
        </div>

        <Field label={form.kind === 'learning' ? '主题' : form.kind === 'hobby' ? '实践内容' : '标题'} error={error ?? undefined}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={form.kind === 'learning' ? '学了什么？' : '做了什么？'} maxLength={120} />
        </Field>

        {form.kind === 'workout' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="运动类型">
              <Select value={form.workoutType} onChange={(e) => set('workoutType', e.target.value as WorkoutType)}>
                {(Object.keys(WORKOUT_TYPE_LABEL) as WorkoutType[]).map((t) => (
                  <option key={t} value={t}>{WORKOUT_TYPE_LABEL[t]}</option>
                ))}
              </Select>
            </Field>
            <Field label="距离（km）">
              <Input type="number" min={0} step="0.1" value={form.distanceKm} onChange={(e) => set('distanceKm', e.target.value)} placeholder="可选" />
            </Field>
            <Field label="主观强度（1-5）">
              <Input type="number" min={1} max={5} value={form.intensity} onChange={(e) => set('intensity', e.target.value)} placeholder="可选" />
            </Field>
          </div>
        )}

        {form.kind === 'hobby' && (
          <Field label="作品链接">
            <Input value={form.workLink} onChange={(e) => set('workLink', e.target.value)} placeholder="https://…（可选）" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="投入时长（分钟）">
            <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} placeholder="如 30" />
          </Field>
          <Field label="关联项目">
            <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">无</option>
              {projects.filter((p) => !form.moduleId || p.moduleId === form.moduleId).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={form.kind === 'workout' ? '备注' : '收获'}>
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={form.kind === 'learning' ? '有什么收获？' : '补充记录'} />
        </Field>
      </div>
    </Dialog>
  )
}
