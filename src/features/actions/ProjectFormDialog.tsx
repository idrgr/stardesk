import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listGoals } from '@/data/repositories/goals'
import { createProject, updateProject } from '@/data/repositories/projects'
import { projectInputSchema } from '@/domain/validation'
import { PROJECT_STATUS_LABEL, type ProjectStatus } from '@/domain/enums'
import type { Project } from '@/domain/entities'

interface FormState {
  title: string
  description: string
  moduleId: string
  goalId: string
  projectType: string
  startDate: string
  targetDate: string
  status: ProjectStatus
  weeklyTargetMinutes: string
}

function emptyForm(moduleId = ''): FormState {
  return {
    title: '',
    description: '',
    moduleId,
    goalId: '',
    projectType: 'other',
    startDate: '',
    targetDate: '',
    status: 'active',
    weeklyTargetMinutes: '',
  }
}

function toForm(p: Project): FormState {
  return {
    title: p.title,
    description: p.description,
    moduleId: p.moduleId,
    goalId: p.goalId ?? '',
    projectType: p.projectType,
    startDate: p.startDate ?? '',
    targetDate: p.targetDate ?? '',
    status: p.status,
    weeklyTargetMinutes: p.weeklyTargetMinutes != null ? String(p.weeklyTargetMinutes) : '',
  }
}

export function ProjectFormDialog({
  open,
  onClose,
  project,
  defaultModuleId,
}: {
  open: boolean
  onClose: () => void
  project?: Project | null
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
    setForm(project ? toForm(project) : emptyForm(defaultModuleId))
    setError(null)
    setSaving(false)
  }, [open, project, defaultModuleId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // 目标仅显示与所选领域一致的目标，保持主领域关系一致。
  const moduleGoals = useMemo(() => goals.filter((g) => g.moduleId === form.moduleId), [goals, form.moduleId])

  const submit = async () => {
    setSaving(true)
    setError(null)
    const parsed = projectInputSchema.safeParse({
      title: form.title,
      description: form.description,
      moduleId: form.moduleId,
      goalId: form.goalId || null,
      projectType: form.projectType,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      status: form.status,
      weeklyTargetMinutes: form.weeklyTargetMinutes === '' ? null : Number(form.weeklyTargetMinutes),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '输入有误')
      setSaving(false)
      return
    }
    try {
      if (project) {
        await updateProject(db, project.id, parsed.data)
        toast('项目已保存', 'success')
      } else {
        await createProject(db, { ...parsed.data, moduleId: parsed.data.moduleId })
        toast('项目已创建', 'success')
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
      title={project ? '编辑项目' : '新增项目'}
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
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="例如：读完一本书" maxLength={120} />
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
              {moduleGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="状态">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="每周投入目标（分钟）">
            <Input type="number" min={0} value={form.weeklyTargetMinutes} onChange={(e) => set('weeklyTargetMinutes', e.target.value)} placeholder="可选" />
          </Field>
        </div>
        <Field label="描述">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="补充说明（可选）" />
        </Field>
      </div>
    </Dialog>
  )
}
