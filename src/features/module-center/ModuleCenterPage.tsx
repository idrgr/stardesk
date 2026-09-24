import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronUp, ChevronDown, Pencil, Archive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { listModules, updateModule } from '@/data/repositories/modules'
import { getIcon, getColor } from '@/modules/registry'
import type { ModuleConfig } from '@/domain/entities'
import { ModuleFormDialog } from './ModuleFormDialog'
import { cn } from '@/lib/cn'

export function ModuleCenterPage() {
  const { db } = useData()
  const { toast } = useToast()
  const modules = useLiveQuery(() => listModules(db), [db]) ?? []
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ModuleConfig | null>(null)

  const active = useMemo(() => modules.filter((m) => !m.archivedAt), [modules])
  const archived = useMemo(() => modules.filter((m) => m.archivedAt), [modules])

  const move = async (m: ModuleConfig, dir: -1 | 1) => {
    const idx = active.findIndex((x) => x.id === m.id)
    const target = active[idx + dir]
    if (!target) return
    await updateModule(db, m.id, { order: target.order })
    await updateModule(db, target.id, { order: m.order })
  }

  const toggleEnabled = async (m: ModuleConfig) => {
    await updateModule(db, m.id, { enabled: !m.enabled })
  }

  const archive = async (m: ModuleConfig) => {
    await updateModule(db, m.id, { archivedAt: new Date().toISOString() })
    toast('模块已归档', 'info')
  }

  const restore = async (m: ModuleConfig) => {
    await updateModule(db, m.id, { archivedAt: null })
    toast('模块已恢复', 'info')
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">模块中心</h1>
          <p className="text-sm text-foreground-muted">管理领域模块，创建自己的模块。</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          新建模块
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {active.map((m, i) => {
          const Icon = getIcon(m.iconKey)
          const color = getColor(m.colorKey)
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                  <Badge tone={m.definitionKey === 'generic' ? 'neutral' : 'accent'}>
                    {m.definitionKey === 'generic' ? '自定义' : '内置'}
                  </Badge>
                  {!m.enabled && <Badge tone="warning">已停用</Badge>}
                </div>
                {m.description && <p className="truncate text-xs text-foreground-muted">{m.description}</p>}
              </div>
              {/* 图标按钮的可访问名称带上模块名：否则一行内多个「编辑/归档」无法区分。 */}
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => move(m, -1)} disabled={i === 0} aria-label={`上移 ${m.name}`} className="rounded p-1.5 text-foreground-muted hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(m, 1)} disabled={i === active.length - 1} aria-label={`下移 ${m.name}`} className="rounded p-1.5 text-foreground-muted hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setEditing(m); setFormOpen(true) }} aria-label={`编辑 ${m.name}`} className="rounded p-1.5 text-foreground-muted hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => toggleEnabled(m)} aria-label={m.enabled ? `停用 ${m.name}` : `启用 ${m.name}`} className={cn('rounded p-1.5', m.enabled ? 'text-foreground-muted hover:text-foreground' : 'text-warning')}>
                  <span className={cn('block h-3 w-6 rounded-full border border-foreground-muted/50 p-0.5', m.enabled && 'border-accent')}>
                    <span className={cn('block h-2 w-2 rounded-full bg-foreground-muted transition-transform', m.enabled && 'translate-x-3 bg-accent')} />
                  </span>
                </button>
                <button type="button" onClick={() => archive(m)} aria-label={`归档 ${m.name}`} className="rounded p-1.5 text-foreground-muted hover:text-foreground">
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground-secondary">已归档</h2>
          <div className="flex flex-col gap-2">
            {archived.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 opacity-70">
                <span className="flex-1 truncate text-sm text-foreground">{m.name}</span>
                <Button variant="ghost" size="sm" onClick={() => restore(m)} aria-label={`恢复 ${m.name}`}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  恢复 {m.name}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <ModuleFormDialog open={formOpen} onClose={() => setFormOpen(false)} module={editing} />
    </div>
  )
}
