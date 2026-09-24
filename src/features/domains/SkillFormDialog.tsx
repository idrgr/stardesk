import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listProjects } from '@/data/repositories/projects'
import { createSkill, updateSkill } from '@/data/repositories/assessments'
import type { SkillAssessment } from '@/domain/entities'

export function SkillFormDialog({
  open,
  onClose,
  skill,
  moduleId,
}: {
  open: boolean
  onClose: () => void
  skill?: SkillAssessment | null
  moduleId: string
}) {
  const { db } = useData()
  const { toast } = useToast()
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []

  const [form, setForm] = useState({
    name: '',
    currentLevel: '1',
    targetLevel: '3',
    description: '',
    evidenceUrls: '',
    learningProjectId: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      skill
        ? {
            name: skill.name,
            currentLevel: String(skill.currentLevel),
            targetLevel: String(skill.targetLevel),
            description: skill.description,
            evidenceUrls: skill.evidenceUrls.join('\n'),
            learningProjectId: skill.learningProjectId ?? '',
          }
        : { name: '', currentLevel: '1', targetLevel: '3', description: '', evidenceUrls: '', learningProjectId: '' },
    )
    setError(null)
    setSaving(false)
  }, [open, skill])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    const name = form.name.trim()
    const currentLevel = Number(form.currentLevel)
    const targetLevel = Number(form.targetLevel)
    if (!name) {
      setError('能力名称不能为空')
      setSaving(false)
      return
    }
    if (currentLevel < 1 || currentLevel > 5 || targetLevel < 1 || targetLevel > 5) {
      setError('等级须在 1-5 之间')
      setSaving(false)
      return
    }
    try {
      const data = {
        name,
        currentLevel,
        targetLevel,
        description: form.description,
        evidenceUrls: form.evidenceUrls.split('\n').map((u) => u.trim()).filter(Boolean),
        learningProjectId: form.learningProjectId || null,
      }
      if (skill) {
        await updateSkill(db, skill.id, data)
        toast('能力项已保存', 'success')
      } else {
        await createSkill(db, { moduleId, ...data })
        toast('能力项已创建', 'success')
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
      title={skill ? '编辑能力项' : '新增能力项'}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="能力名称" error={error ?? undefined}>
          <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例如：TypeScript" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="当前等级（1-5）">
            <Input type="number" min={1} max={5} value={form.currentLevel} onChange={(e) => set('currentLevel', e.target.value)} />
          </Field>
          <Field label="目标等级（1-5）">
            <Input type="number" min={1} max={5} value={form.targetLevel} onChange={(e) => set('targetLevel', e.target.value)} />
          </Field>
        </div>
        <Field label="关联学习项目">
          <Select value={form.learningProjectId} onChange={(e) => set('learningProjectId', e.target.value)}>
            <option value="">无</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="自评说明">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="简要说明当前水平与依据" />
        </Field>
        <Field label="证据链接（每行一个）">
          <Textarea value={form.evidenceUrls} onChange={(e) => set('evidenceUrls', e.target.value)} placeholder="https://…" />
        </Field>
      </div>
    </Dialog>
  )
}
