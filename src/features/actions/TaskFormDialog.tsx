import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listGoals } from '@/data/repositories/goals'
import { listProjects } from '@/data/repositories/projects'
import { queryTasks, createTask, updateTask, type NewTaskInput } from '@/data/repositories/tasks'
import { TASK_PRIORITY_LABEL, type TaskPriority, type TaskStatus } from '@/domain/enums'
import type { Task } from '@/domain/entities'
import { taskInputSchema } from '@/domain/validation'
import { cn } from '@/lib/cn'

interface FormState {
  title: string
  description: string
  moduleId: string
  goalId: string
  projectId: string
  parentTaskId: string
  priority: TaskPriority
  status: TaskStatus
  plannedDate: string
  scheduledTime: string
  dueDate: string
  estimatedMinutes: string
  tags: string
}

/** 位于「更多字段」折叠区内的字段：这些字段报错时必须自动展开，否则提示不可见。 */
const ADVANCED_FIELDS = ['description', 'parentTaskId', 'scheduledTime', 'estimatedMinutes', 'dueDate', 'tags'] as const

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    moduleId: '',
    goalId: '',
    projectId: '',
    parentTaskId: '',
    priority: 'medium',
    status: 'todo',
    plannedDate: '',
    scheduledTime: '',
    dueDate: '',
    estimatedMinutes: '',
    tags: '',
  }
}

function toForm(task: Task): FormState {
  return {
    title: task.title,
    description: task.description,
    moduleId: task.moduleId ?? '',
    goalId: task.goalId ?? '',
    projectId: task.projectId ?? '',
    parentTaskId: task.parentTaskId ?? '',
    priority: task.priority,
    status: task.status,
    plannedDate: task.plannedDate ?? '',
    scheduledTime: task.scheduledTime ?? '',
    dueDate: task.dueDate ?? '',
    estimatedMinutes: task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
    tags: task.tags.join(', '),
  }
}

export function TaskFormDialog({
  open,
  onClose,
  task,
  defaultModuleId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultModuleId?: string
  onSaved?: (task: Task) => void
}) {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []
  const allTasks = useLiveQuery(() => queryTasks(db, {}), [db]) ?? []

  const [form, setForm] = useState<FormState>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [openedRevision, setOpenedRevision] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(task ? toForm(task) : { ...emptyForm(), moduleId: defaultModuleId ?? '' })
    setOpenedRevision(task?.revision ?? null)
    setErrors({})
    setFormError(null)
    setSaving(false)
    setAdvanced(false)
  }, [open, task, defaultModuleId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // 领域一致的目标/项目。
  const moduleGoals = useMemo(() => goals.filter((g) => !form.moduleId || g.moduleId === form.moduleId), [goals, form.moduleId])
  const moduleProjects = useMemo(() => projects.filter((p) => !form.moduleId || p.moduleId === form.moduleId), [projects, form.moduleId])

  // 可作父任务的任务：顶层任务、非自身。
  const parentCandidates = useMemo(
    () => allTasks.filter((t) => !t.parentTaskId && t.id !== task?.id),
    [allTasks, task],
  )

  const selectedProject = projects.find((p) => p.id === form.projectId)

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    setForm((f) => ({
      ...f,
      projectId,
      goalId: project ? project.goalId ?? '' : f.goalId,
    }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setErrors({})

    const input: NewTaskInput = {
      title: form.title,
      description: form.description,
      moduleId: form.moduleId || null,
      goalId: form.projectId ? null : form.goalId || null, // 有项目时由仓储继承目标
      projectId: form.projectId || null,
      parentTaskId: form.parentTaskId || null,
      priority: form.priority,
      plannedDate: form.plannedDate || null,
      scheduledTime: form.scheduledTime || null,
      dueDate: form.dueDate || null,
      estimatedMinutes: form.estimatedMinutes.trim() === '' ? null : Number(form.estimatedMinutes),
      tags: form.tags.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean),
    }

    const parsed = taskInputSchema.safeParse({
      ...input,
      status: form.status,
      goalId: input.goalId,
      parentTaskId: input.parentTaskId,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const path = issue?.path?.[0] as keyof FormState | undefined
      const message = issue?.message || '输入有误，请检查'
      // 校验失败的字段若在「更多字段」里，必须展开，否则用户看不到任何提示。
      if (path && (ADVANCED_FIELDS as readonly string[]).includes(path as string)) {
        setAdvanced(true)
      }
      setFormError(message)
      if (path) setErrors({ [path]: message })
      setSaving(false)
      return
    }

    try {
      if (task) {
        await updateTask(
          db,
          task.id,
          {
            title: input.title,
            description: input.description,
            moduleId: input.moduleId,
            goalId: input.goalId,
            projectId: input.projectId,
            parentTaskId: input.parentTaskId,
            priority: input.priority,
            plannedDate: input.plannedDate,
            scheduledTime: input.scheduledTime,
            dueDate: input.dueDate,
            estimatedMinutes: input.estimatedMinutes,
            tags: input.tags,
            status: form.status,
          },
          openedRevision ?? undefined,
        )
        toast('任务已保存', 'success')
      } else {
        await createTask(db, input)
        toast('任务已创建', 'success')
      }
      onClose()
      onSaved?.(task as Task)
    } catch (e) {
      if (e instanceof Error && e.name === 'RevisionConflictError') {
        setFormError('该任务已被其他页面修改，请关闭后重新打开再编辑。')
      } else if (e instanceof Error && e.name === 'StaleDataError') {
        // 统一使用数据层提供的说明，避免多处文案不一致。
        setFormError(e.message)
      } else {
        setFormError(e instanceof Error ? `保存失败：${e.message}` : '保存失败，请重试')
      }
      // 保留用户已填写的内容，不清空表单。
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose()
      }}
      title={task ? '编辑任务' : '新增任务'}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        <Field label="标题" error={errors.title}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="要做什么？" maxLength={120} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="优先级">
            <div className="flex gap-1">
              {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                <button key={p} type="button" onClick={() => set('priority', p)} aria-pressed={form.priority === p}
                  className={cn('flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors', form.priority === p ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface')}>
                  {TASK_PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="计划日期">
            <Input type="date" value={form.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} />
          </Field>
        </div>

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
            <Select value={form.projectId} onChange={(e) => handleProjectChange(e.target.value)}>
              <option value="">无</option>
              {moduleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="所属目标" hint={selectedProject ? '随项目自动关联' : undefined}>
          {selectedProject ? (
            <Input value={goals.find((g) => g.id === selectedProject.goalId)?.title ?? '项目无关联目标'} disabled />
          ) : (
            <Select value={form.goalId} onChange={(e) => set('goalId', e.target.value)}>
              <option value="">无</option>
              {moduleGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </Select>
          )}
        </Field>

        <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1 self-start text-xs text-foreground-secondary hover:text-foreground">
          {advanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          更多字段
        </button>

        {advanced && (
          <div className="flex flex-col gap-4">
            <Field label="描述">
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="补充说明（可选）" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="父任务（子任务）">
                <Select value={form.parentTaskId} onChange={(e) => set('parentTaskId', e.target.value)}>
                  <option value="">无（顶层任务）</option>
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </Select>
              </Field>
              <Field label="具体时间" error={errors.scheduledTime}>
                <Input type="time" value={form.scheduledTime} onChange={(e) => set('scheduledTime', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="预计时长（分钟）" error={errors.estimatedMinutes}>
                <Input type="number" min={0} value={form.estimatedMinutes} onChange={(e) => set('estimatedMinutes', e.target.value)} placeholder="如 30" />
              </Field>
              <Field label="截止日期">
                <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
              </Field>
            </div>
            <Field label="标签（逗号分隔）">
              <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="阅读, 学习" />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  )
}
