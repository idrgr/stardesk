import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Repeat } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listProjects } from '@/data/repositories/projects'
import { convertFocusToActivity, findActivityByFocusSession } from '@/data/repositories/activities'
import { ACTIVITY_KIND_LABEL, WORKOUT_TYPE_LABEL, type ActivityKind, type WorkoutType } from '@/domain/enums'
import { todayInTimeZone } from '@/lib/date'
import { activityInputSchema } from '@/domain/validation'
import type { ActivityLog, FocusSession } from '@/domain/entities'

/**
 * 把一次已完成的专注会话显式转为领域活动记录。
 * 已转换过的会话会直接显示既有记录，不提供重复提交。
 */
export function ConvertToActivityDialog({
  open,
  onClose,
  session,
  defaultModuleId,
  defaultTitle,
}: {
  open: boolean
  onClose: () => void
  session: FocusSession | null
  defaultModuleId?: string | null
  defaultTitle?: string
}) {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()
  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'

  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const existing = useLiveQuery(
    async () => (session ? await findActivityByFocusSession(db, session.id) : undefined),
    [db, session?.id],
  )

  const [form, setForm] = useState({
    kind: 'generic' as ActivityKind,
    moduleId: '',
    projectId: '',
    localDate: todayInTimeZone(timeZone),
    title: '',
    durationMinutes: '0',
    note: '',
    workoutType: 'other' as WorkoutType,
    distanceKm: '',
    intensity: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !session) return
    const minutes = Math.round((session.actualSeconds ?? session.accumulatedActiveSeconds) / 60)
    setForm({
      kind: 'generic',
      moduleId: defaultModuleId ?? session.moduleId ?? '',
      projectId: '',
      localDate: session.localDate ?? todayInTimeZone(timeZone),
      title: defaultTitle ?? session.note?.trim() ?? '专注记录',
      durationMinutes: String(minutes),
      note: '',
      workoutType: 'other',
      distanceKm: '',
      intensity: '',
    })
    setError(null)
    setSaving(false)
  }, [open, session?.id, defaultModuleId, defaultTitle, timeZone])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const moduleProjects = useMemo(
    () => projects.filter((p) => !form.moduleId || p.moduleId === form.moduleId),
    [projects, form.moduleId],
  )

  const submit = async () => {
    if (!session) return
    setSaving(true)
    setError(null)

    const details: ActivityLog['details'] = {}
    if (form.kind === 'workout') {
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
      const result = await convertFocusToActivity(db, {
        focusSessionId: session.id,
        moduleId: parsed.data.moduleId,
        projectId: parsed.data.projectId ?? null,
        kind: parsed.data.kind,
        localDate: parsed.data.localDate,
        title: parsed.data.title ?? '专注记录',
        durationMinutes: parsed.data.durationMinutes ?? null,
        note: parsed.data.note ?? '',
        details,
      })
      toast(result.created ? '已生成领域记录' : '该专注此前已转换过，未重复创建', result.created ? 'success' : 'info')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '转换失败')
    } finally {
      setSaving(false)
    }
  }

  if (!session) return null

  // 已转换过：只展示既有记录，杜绝重复提交。
  if (existing) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="转为领域记录"
        width="max-w-md"
        footer={<Button variant="primary" onClick={onClose}>知道了</Button>}
      >
        <div className="flex items-start gap-3">
          <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="text-sm text-foreground-secondary">
            <p className="text-foreground">这次专注已经转换过，不会重复创建记录。</p>
            <p className="mt-1 text-xs text-foreground-muted">
              既有记录：{existing.title} · {existing.localDate}
              {existing.durationMinutes != null && ` · ${existing.durationMinutes} 分钟`}
            </p>
          </div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title="转为领域记录"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? '保存中…' : '生成记录'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-divider bg-surface px-3 py-2 text-xs text-foreground-muted">
          专注时长会作为活动记录的时长。转换不会自动完成关联任务。
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="所属领域">
            <Select value={form.moduleId} onChange={(e) => set('moduleId', e.target.value)}>
              <option value="">请选择领域</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="活动类型">
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value as ActivityKind)}>
              {(Object.keys(ACTIVITY_KIND_LABEL) as ActivityKind[]).map((k) => (
                <option key={k} value={k}>{ACTIVITY_KIND_LABEL[k]}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="统计日期">
            <Input type="date" value={form.localDate} onChange={(e) => set('localDate', e.target.value)} />
          </Field>
          <Field label="时长（分钟）">
            <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} />
          </Field>
        </div>

        <Field label="标题" error={error ?? undefined}>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="这次专注做了什么？" maxLength={120} />
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
            <Field label="强度（1-5）">
              <Input type="number" min={1} max={5} value={form.intensity} onChange={(e) => set('intensity', e.target.value)} placeholder="可选" />
            </Field>
          </div>
        )}

        <Field label="关联项目">
          <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">无</option>
            {moduleProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </Field>

        <Field label="收获 / 备注">
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="可选" />
        </Field>
      </div>
    </Dialog>
  )
}
