import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, Pin, Star, BookOpen, Link2, Check, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/app/data-context'
import { useToast } from '@/components/ui/Toast'
import { queryNotes, toggleNotePin, archiveNotes } from '@/data/repositories/notes'
import { queryResources, updateResource, archiveResources } from '@/data/repositories/resources'
import { listEnabledModules } from '@/data/repositories/modules'
import { RESOURCE_TYPE_LABEL, READ_STATUS_LABEL, type ReadStatus, type ResourceType } from '@/domain/enums'
import { formatDateShort } from '@/lib/date'
import type { Note, Resource } from '@/domain/entities'
import { NoteEditorDialog } from './NoteEditorDialog'
import { ResourceFormDialog } from './ResourceFormDialog'
import { cn } from '@/lib/cn'

export function KnowledgePage() {
  const { db } = useData()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'resources' ? 'resources' : 'notes'

  const setTab = (t: 'notes' | 'resources') => {
    const p = new URLSearchParams(searchParams)
    p.set('tab', t)
    setSearchParams(p, { replace: true })
  }

  const [keyword, setKeyword] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [resourceOpen, setResourceOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [readFilter, setReadFilter] = useState<'all' | ReadStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | ResourceType>('all')

  const notes = useLiveQuery(() => queryNotes(db, {}), [db]) ?? []
  const resources = useLiveQuery(() => queryResources(db, {}), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []
  const moduleNames = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules])

  const filteredNotes = useMemo(() => {
    let list = notes
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((n) => n.title.toLowerCase().includes(kw) || n.bodyMarkdown.toLowerCase().includes(kw) || n.tags.some((t) => t.toLowerCase().includes(kw)))
    }
    if (moduleId) list = list.filter((n) => n.moduleId === moduleId)
    return list
  }, [notes, keyword, moduleId])

  const filteredResources = useMemo(() => {
    let list = resources
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((r) => r.title.toLowerCase().includes(kw) || r.description.toLowerCase().includes(kw) || r.tags.some((t) => t.toLowerCase().includes(kw)))
    }
    if (moduleId) list = list.filter((r) => r.moduleId === moduleId)
    if (readFilter !== 'all') list = list.filter((r) => r.readStatus === readFilter)
    if (typeFilter !== 'all') list = list.filter((r) => r.resourceType === typeFilter)
    return list
  }, [resources, keyword, moduleId, readFilter, typeFilter])

  const toggleFavorite = async (r: Resource) => {
    await updateResource(db, r.id, { favorite: !r.favorite })
  }
  const toggleRead = async (r: Resource) => {
    await updateResource(db, r.id, { readStatus: r.readStatus === 'read' ? 'pending' : 'read' })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">知识库</h1>
        <p className="text-sm text-foreground-muted">笔记与资源的沉淀之处</p>
      </div>

      <div className="flex gap-1 border-b border-divider">
        {(['notes', 'resources'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('relative px-4 py-2 text-sm transition-colors', tab === t ? 'text-accent' : 'text-foreground-secondary hover:text-foreground')}
          >
            {t === 'notes' ? '笔记' : '资源'}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {/* 筛选 + 新增 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={tab === 'notes' ? '搜索笔记…' : '搜索资源…'}
            aria-label={tab === 'notes' ? '搜索笔记' : '搜索资源'}
            className="pl-9"
          />
        </div>
        <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="w-36" aria-label="按领域筛选">
          <option value="">全部领域</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
        {tab === 'resources' && (
          <>
            <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value as 'all' | ReadStatus)} className="w-28" aria-label="按阅读状态筛选">
              <option value="all">全部状态</option>
              <option value="pending">待查看</option>
              <option value="read">已查看</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | ResourceType)} className="w-28" aria-label="按类型筛选">
              <option value="all">全部类型</option>
              {(Object.keys(RESOURCE_TYPE_LABEL) as ResourceType[]).map((t) => (
                <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </>
        )}
        <div className="ml-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (tab === 'notes') {
                setEditingNote(null)
                setNoteOpen(true)
              } else {
                setEditingResource(null)
                setResourceOpen(true)
              }
            }}
          >
            <Plus className="h-4 w-4" />
            {tab === 'notes' ? '新增笔记' : '新增资源'}
          </Button>
        </div>
      </div>

      {tab === 'notes' ? (
        filteredNotes.length === 0 ? (
          <EmptyState icon={BookOpen} title={keyword || moduleId ? '没有符合条件的笔记' : '还没有笔记'} description={keyword || moduleId ? '清除筛选后再看看。' : '把想法、收获和资料沉淀下来。'} />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredNotes.map((n) => (
              <div key={n.id} className="group rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => { setEditingNote(n); setNoteOpen(true) }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-foreground hover:text-accent">{n.title}</p>
                    {n.bodyMarkdown && <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">{n.bodyMarkdown}</p>}
                  </button>
                  <div className="flex shrink-0 gap-1 sd-reveal-on-hover">
                    <button type="button" onClick={() => toggleNotePin(db, n.id)} aria-label={n.pinned ? '取消置顶' : '置顶'} className="rounded p-1 text-foreground-muted hover:text-foreground">
                      <Pin className={cn('h-3.5 w-3.5', n.pinned && 'fill-current text-accent')} />
                    </button>
                    <button type="button" onClick={() => { archiveNotes(db, [n.id]); toast('已归档', 'info') }} aria-label="归档" className="rounded p-1 text-foreground-muted hover:text-foreground">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                  {n.moduleId && moduleNames.get(n.moduleId) && <span>{moduleNames.get(n.moduleId)}</span>}
                  <span>更新于 {formatDateShort(n.updatedAt.slice(0, 10))}</span>
                  {n.pinned && <Badge tone="accent">置顶</Badge>}
                  {n.tags.map((t) => (
                    <Badge key={t} tone="neutral">{t}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredResources.length === 0 ? (
        <EmptyState icon={Link2} title={keyword || moduleId || readFilter !== 'all' || typeFilter !== 'all' ? '没有符合条件的资源' : '还没有资源'} description={keyword || moduleId || readFilter !== 'all' || typeFilter !== 'all' ? '清除筛选后再看看。' : '收藏文章、视频、课程和书籍链接。'} />
      ) : (
        <div className="flex flex-col gap-2">
          {filteredResources.map((r) => (
            <div key={r.id} className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3">
              <Link2 className="h-4 w-4 shrink-0 text-foreground-muted" />
              <div className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="truncate text-sm font-medium text-foreground hover:text-accent">
                  {r.title}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                  <Badge tone="neutral">{RESOURCE_TYPE_LABEL[r.resourceType]}</Badge>
                  <span>{READ_STATUS_LABEL[r.readStatus]}</span>
                  {r.moduleId && moduleNames.get(r.moduleId) && <span>{moduleNames.get(r.moduleId)}</span>}
                  {r.description && <span className="truncate">{r.description}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 sd-reveal-on-hover">
                <button type="button" onClick={() => toggleRead(r)} aria-label={r.readStatus === 'read' ? '标记待查看' : '标记已查看'} className="rounded p-1.5 text-foreground-muted hover:text-foreground">
                  <Check className={cn('h-3.5 w-3.5', r.readStatus === 'read' && 'text-success')} />
                </button>
                <button type="button" onClick={() => toggleFavorite(r)} aria-label={r.favorite ? '取消收藏' : '收藏'} className={cn('rounded p-1.5', r.favorite ? 'text-warning' : 'text-foreground-muted hover:text-foreground')}>
                  <Star className={cn('h-3.5 w-3.5', r.favorite && 'fill-current')} />
                </button>
                <button type="button" onClick={() => { setEditingResource(r); setResourceOpen(true) }} aria-label="编辑资源" className="rounded p-1.5 text-foreground-muted hover:text-foreground">
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <NoteEditorDialog open={noteOpen} onClose={() => setNoteOpen(false)} note={editingNote} />
      <ResourceFormDialog open={resourceOpen} onClose={() => setResourceOpen(false)} resource={editingResource} />
    </div>
  )
}
