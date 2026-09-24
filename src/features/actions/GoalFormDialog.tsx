import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { createGoal, updateGoal } from '@/data/repositories/goals'
import { goalInputSchema } from '@/domain/validation'
import { GOAL_STATUS_LABEL, type GoalStatus, type ProgressMode } from '@/domain/enums'
import type { Goal } from '@/domain/entities'
import { cn } from '@/lib/cn'

interface FormState {
  title: string
  description: string
  moduleId: string
  startDate: string
  targetDate: string
  status: GoalStatus
  progressMode: ProgressMode
  manualProgress: string
}

function emptyForm(moduleId = ''): FormState {
  return {
    title: '',
    description: '',
    moduleId,
    startDate: '',
    targetDate: '',
    status: 'not_started',
    progressMode: 'auto',
    manualProgress: '0',
  }
}

function toForm(g: Goal): FormState {
  return {
    title: g.title,
    description: g.description,
    moduleId: g.moduleId,
    startDate: g.startDate ?? '',
    targetDate: g.targetDate ?? '',
    status: g.status,
    progressMode: g.progressMode,
    manualProgress: g.manualProgress != null ? String(g.manualProgress) : '0',
  }
}

export function GoalFormDialog({
  open,
  onClose,
  goal,
  defaultModuleId,
}: {
  open: boolean
  onClose: () => void
  goal?: Goal | null
  defaultModuleId?: string
}) {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(goal ? toForm(goal) : emptyForm(defaultModuleId))
    setError(null)
    setSaving(false)
  }, [open, goal, defaultModuleId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    const parsed = goalInputSchema.safeParse({
      title: form.title,
      description: form.description,
      moduleId: form.moduleId,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      status: form.status,
      progressMode: form.progressMode,
      manualProgress:
        form.progressMode === 'manual' ? Number(form.manualProgress) : null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '输入有误')
      setSaving(false)
      return
    }
    try {
      if (goal) {
        await updateGoal(db, goal.id, parsed.data)
        toast('目标已保存', 'success')
      } else {
        await createGoal(db, { ...parsed.data, moduleId: parsed.data.moduleId })
        toast('目标已创建', 'success')
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
      title={goal ? '编辑目标' : '新增目标'}
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
        <Field label="标题" error={error ?? undefined}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="目标是什么？" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="所属领域">
            <Select value={form.moduleId} onChange={(e) => set('moduleId', e.target.value)}>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="状态">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as GoalStatus)}>
              {(Object.keys(GOAL_STATUS_LABEL) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>{GOAL_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期">
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="目标日期">
            <Input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
          </Field>
        </div>
        <Field label="进度模式">
          <div className="flex gap-1">
            {(['auto', 'manual'] as ProgressMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set('progressMode', m)}
                aria-pressed={form.progressMode === m}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-xs',
                  form.progressMode === m ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface',
                )}
              >
                {m === 'auto' ? '自动（按任务）' : '手动更新'}
              </button>
            ))}
          </div>
        </Field>
        {form.progressMode === 'manual' && (
          <Field label="进度（0-100）">
            <Input type="number" min={0} max={100} value={form.manualProgress} onChange={(e) => set('manualProgress', e.target.value)} />
          </Field>
        )}
        <Field label="描述">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="补充说明（可选）" />
        </Field>
      </div>
    </Dialog>
  )
}
