import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { createModule, updateModule } from '@/data/repositories/modules'
import { ICON_KEYS, COLOR_KEYS, getIcon, getColor } from '@/modules/registry'
import { MODULE_CAPABILITY_LABEL, type ModuleCapability } from '@/domain/enums'
import type { ModuleConfig } from '@/domain/entities'
import { cn } from '@/lib/cn'

export function ModuleFormDialog({
  open,
  onClose,
  module,
}: {
  open: boolean
  onClose: () => void
  module?: ModuleConfig | null
}) {
  const { db } = useData()
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '',
    description: '',
    iconKey: 'layers',
    colorKey: 'other',
    capabilities: ['tasks', 'goals', 'projects', 'habits', 'notes', 'activities'] as ModuleCapability[],
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      module
        ? { name: module.name, description: module.description, iconKey: module.iconKey, colorKey: module.colorKey, capabilities: [...module.capabilities] }
        : { name: '', description: '', iconKey: 'layers', colorKey: 'other', capabilities: ['tasks', 'goals', 'projects', 'habits', 'notes', 'activities'] },
    )
    setError(null)
    setSaving(false)
  }, [open, module])

  const toggleCapability = (c: ModuleCapability) =>
    setForm((f) => ({
      ...f,
      capabilities: f.capabilities.includes(c) ? f.capabilities.filter((x) => x !== c) : [...f.capabilities, c],
    }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    const name = form.name.trim()
    if (!name) {
      setError('模块名称不能为空')
      setSaving(false)
      return
    }
    try {
      if (module) {
        await updateModule(db, module.id, { name, description: form.description, iconKey: form.iconKey, colorKey: form.colorKey })
        toast('模块已保存', 'success')
      } else {
        await createModule(db, { name, description: form.description, iconKey: form.iconKey, colorKey: form.colorKey, capabilities: form.capabilities })
        toast('模块已创建', 'success')
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
      title={module ? '编辑模块' : '新建模块'}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="名称" error={error ?? undefined}>
          <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="例如：旅行计划" maxLength={120} />
        </Field>
        <Field label="描述">
          <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="这个模块用来做什么（可选）" />
        </Field>

        <Field label="图标">
          <div className="flex flex-wrap gap-1.5">
            {ICON_KEYS.map((key) => {
              const Icon = getIcon(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, iconKey: key }))}
                  aria-label={key}
                  className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', form.iconKey === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface')}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="颜色">
          <div className="flex flex-wrap gap-2">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, colorKey: key }))}
                aria-label={key}
                className={cn('h-8 w-8 rounded-full border-2 transition-transform', form.colorKey === key ? 'scale-110 border-foreground' : 'border-transparent')}
                style={{ backgroundColor: getColor(key) }}
              />
            ))}
          </div>
        </Field>

        {!module && (
          <Field label="启用的能力" hint="模块可用的功能（目标、项目、任务、习惯、笔记、活动记录）">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODULE_CAPABILITY_LABEL) as ModuleCapability[]).map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground-secondary">
                  <input type="checkbox" checked={form.capabilities.includes(c)} onChange={() => toggleCapability(c)} className="h-3.5 w-3.5 accent-[#5DE4F5]" />
                  {MODULE_CAPABILITY_LABEL[c]}
                </label>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Dialog>
  )
}
