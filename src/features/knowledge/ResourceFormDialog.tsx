import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listEnabledModules } from '@/data/repositories/modules'
import { listProjects } from '@/data/repositories/projects'
import { createResource, updateResource } from '@/data/repositories/resources'
import { RESOURCE_TYPE_LABEL, type ResourceType } from '@/domain/enums'
import { isSafeUrl } from '@/domain/validation'
import type { Resource } from '@/domain/entities'

export function ResourceFormDialog({
  open,
  onClose,
  resource,
  defaultModuleId,
}: {
  open: boolean
  onClose: () => void
  resource?: Resource | null
  defaultModuleId?: string
}) {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []

  const [form, setForm] = useState({
    title: '',
    url: '',
    resourceType: 'article' as ResourceType,
    description: '',
    moduleId: '',
    projectId: '',
    tags: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      resource
        ? {
            title: resource.title,
            url: resource.url,
            resourceType: resource.resourceType,
            description: resource.description,
            moduleId: resource.moduleId ?? '',
            projectId: resource.projectId ?? '',
            tags: resource.tags.join(', '),
          }
        : { title: '', url: '', resourceType: 'article', description: '', moduleId: defaultModuleId ?? '', projectId: '', tags: '' },
    )
    setError(null)
    setSaving(false)
  }, [open, resource, defaultModuleId])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const moduleProjects = useMemo(() => projects.filter((p) => !form.moduleId || p.moduleId === form.moduleId), [projects, form.moduleId])

  const submit = async () => {
    setSaving(true)
    setError(null)
    const title = form.title.trim()
    const url = form.url.trim()
    if (!title) {
      setError('标题不能为空')
      setSaving(false)
      return
    }
    if (!isSafeUrl(url)) {
      setError('链接只支持 http 或 https 协议')
      setSaving(false)
      return
    }
    try {
      const data = {
        title,
        url,
        resourceType: form.resourceType,
        description: form.description,
        moduleId: form.moduleId || null,
        projectId: form.projectId || null,
        tags: form.tags.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean),
      }
      if (resource) {
        await updateResource(db, resource.id, data)
        toast('资源已保存', 'success')
      } else {
        await createResource(db, data)
        toast('资源已创建', 'success')
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
      title={resource ? '编辑资源' : '新增资源'}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="标题" error={error ?? undefined}>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="资源标题" maxLength={120} />
        </Field>
        <Field label="链接">
          <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <Select value={form.resourceType} onChange={(e) => set('resourceType', e.target.value as ResourceType)}>
              {(Object.keys(RESOURCE_TYPE_LABEL) as ResourceType[]).map((t) => (
                <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="所属领域">
            <Select value={form.moduleId} onChange={(e) => set('moduleId', e.target.value)}>
              <option value="">无</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="所属项目">
            <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">无</option>
              {moduleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="标签（逗号分隔）">
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="前端, 参考" />
          </Field>
        </div>
        <Field label="说明">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="简要说明（可选）" />
        </Field>
      </div>
    </Dialog>
  )
}
