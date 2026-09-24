import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listGoals } from '@/data/repositories/goals'
import { createHabit, updateHabit } from '@/data/repositories/habits'
import { todayInTimeZone } from '@/lib/date'
import type { Habit, HabitFrequency } from '@/domain/entities'
import { cn } from '@/lib/cn'

const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
]

interface FormState {
  title: string
  description: string
  moduleId: string
  goalId: string
  startDate: string
  endDate: string
  cadence: 'daily' | 'weekly'
  daysOfWeek: number[]
}

function emptyForm(moduleId = ''): FormState {
  return {
    title: '',
    description: '',
    moduleId,
    goalId: '',
    startDate: todayInTimeZone('Asia/Shanghai'),
    endDate: '',
    cadence: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5],
  }
}

function toForm(h: Habit): FormState {
  const freq = h.scheduleVersions.at(-1)?.frequency
  return {
    title: h.title,
    description: h.description,
    moduleId: h.moduleId,
    goalId: h.goalId ?? '',
    startDate: h.startDate,
    endDate: h.endDate ?? '',
    cadence: freq?.cadence ?? 'daily',
    daysOfWeek: freq?.daysOfWeek ?? [1, 2, 3, 4, 5],
  }
}

export function HabitFormDialog({
  open,
  onClose,
  habit,
  defaultModuleId,
}: {
  open: boolean
  onClose: () => void
  habit?: Habit | null
  defaultModuleId?: string
}) {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(habit ? toForm(habit) : emptyForm(defaultModuleId))
    setError(null)
    setSaving(false)
  }, [open, habit, defaultModuleId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d],
    }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    const title = form.title.trim()
    if (!title) {
      setError('名称不能为空')
      setSaving(false)
      return
    }
    if (form.cadence === 'weekly' && form.daysOfWeek.length === 0) {
      setError('每周习惯请至少选择一个星期')
      setSaving(false)
      return
    }
    const frequency: HabitFrequency =
      form.cadence === 'daily'
        ? { cadence: 'daily', daysOfWeek: [] }
        : { cadence: 'weekly', daysOfWeek: [...form.daysOfWeek].sort((a, b) => a - b) }

    try {
      if (habit) {
        await updateHabit(
          db,
          habit.id,
          {
            title,
            description: form.description,
            endDate: form.endDate || null,
            frequency,
          },
          todayInTimeZone('Asia/Shanghai'),
        )
        toast('习惯已保存', 'success')
      } else {
        await createHabit(db, {
          title,
          description: form.description,
          moduleId: form.moduleId,
          goalId: form.goalId || null,
          startDate: form.startDate || todayInTimeZone('Asia/Shanghai'),
          endDate: form.endDate || null,
          frequency,
        })
        toast('习惯已创建', 'success')
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
      title={habit ? '编辑习惯' : '新增习惯'}
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
        <Field label="名称" error={error ?? undefined}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="例如：每天喝水" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="所属领域">
            <Select value={form.moduleId} onChange={(e) => set('moduleId', e.target.value)}>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="关联目标">
            <Select value={form.goalId} onChange={(e) => set('goalId', e.target.value)}>
              <option value="">无</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="频率">
          <div className="flex gap-1">
            {(['daily', 'weekly'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('cadence', c)}
                aria-pressed={form.cadence === c}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-xs',
                  form.cadence === c ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface',
                )}
              >
                {c === 'daily' ? '每天' : '每周指定星期'}
              </button>
            ))}
          </div>
        </Field>
        {form.cadence === 'weekly' && (
          <Field label="星期">
            <div className="flex gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={form.daysOfWeek.includes(d.value)}
                  className={cn(
                    'h-9 w-9 rounded-lg border text-sm transition-colors',
                    form.daysOfWeek.includes(d.value)
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-foreground-secondary hover:bg-surface',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="启用日期">
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="结束日期（可选）">
            <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        </div>
        <Field label="描述">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="补充说明（可选）" />
        </Field>
      </div>
    </Dialog>
  )
}
