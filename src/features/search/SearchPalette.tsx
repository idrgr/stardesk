import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ListChecks, BookOpen, Link2, Target, FolderKanban, CornerDownLeft } from 'lucide-react'
import { useData } from '@/app/data-context'
import { queryTasks } from '@/data/repositories/tasks'
import { queryNotes } from '@/data/repositories/notes'
import { queryResources } from '@/data/repositories/resources'
import { listGoals } from '@/data/repositories/goals'
import { listProjects } from '@/data/repositories/projects'
import { TASK_STATUS_LABEL } from '@/domain/enums'
import { cn } from '@/lib/cn'

interface Result {
  id: string
  type: 'task' | 'note' | 'resource' | 'goal' | 'project'
  title: string
  sub: string
  to: string
}

const TYPE_LABEL: Record<Result['type'], string> = {
  task: '任务',
  note: '笔记',
  resource: '资源',
  goal: '目标',
  project: '项目',
}

function typeIcon(type: Result['type']) {
  switch (type) {
    case 'task': return <ListChecks className="h-4 w-4 shrink-0 text-foreground-muted" />
    case 'note': return <BookOpen className="h-4 w-4 shrink-0 text-foreground-muted" />
    case 'resource': return <Link2 className="h-4 w-4 shrink-0 text-foreground-muted" />
    case 'goal': return <Target className="h-4 w-4 shrink-0 text-foreground-muted" />
    case 'project': return <FolderKanban className="h-4 w-4 shrink-0 text-foreground-muted" />
  }
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db } = useData()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const tasks = useLiveQuery(() => queryTasks(db, { includeDone: true }), [db]) ?? []
  const notes = useLiveQuery(() => queryNotes(db, {}), [db]) ?? []
  const resources = useLiveQuery(() => queryResources(db, {}), [db]) ?? []
  const goals = useLiveQuery(() => listGoals(db), [db]) ?? []
  const projects = useLiveQuery(() => listProjects(db), [db]) ?? []

  const results = useMemo<Result[]>(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    const out: Result[] = []
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw) || t.tags.some((x) => x.toLowerCase().includes(kw))) {
        out.push({ id: t.id, type: 'task', title: t.title, sub: TASK_STATUS_LABEL[t.status], to: `/actions?tab=tasks&q=${encodeURIComponent(t.title)}` })
      }
    }
    for (const n of notes) {
      if (n.title.toLowerCase().includes(kw) || n.bodyMarkdown.toLowerCase().includes(kw) || n.tags.some((x) => x.toLowerCase().includes(kw))) {
        out.push({ id: n.id, type: 'note', title: n.title, sub: '笔记', to: '/knowledge?tab=notes' })
      }
    }
    for (const r of resources) {
      if (r.title.toLowerCase().includes(kw) || r.description.toLowerCase().includes(kw) || r.tags.some((x) => x.toLowerCase().includes(kw))) {
        out.push({ id: r.id, type: 'resource', title: r.title, sub: '资源', to: '/knowledge?tab=resources' })
      }
    }
    for (const g of goals) {
      if (g.title.toLowerCase().includes(kw)) {
        out.push({ id: g.id, type: 'goal', title: g.title, sub: '目标', to: '/actions?tab=goals' })
      }
    }
    for (const p of projects) {
      if (p.title.toLowerCase().includes(kw)) {
        out.push({ id: p.id, type: 'project', title: p.title, sub: '项目', to: '/actions?tab=projects' })
      }
    }
    return out.slice(0, 10)
  }, [tasks, notes, resources, goals, projects, keyword])

  useEffect(() => {
    if (open) {
      setKeyword('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const target = results[index]
        if (target) {
          navigate(target.to)
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, results, index, navigate, onClose])

  useEffect(() => setIndex(0), [keyword])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="搜索" className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-divider px-4">
          <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索任务、笔记、资源、目标、项目…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {keyword.trim() === '' ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">输入关键词，搜索整个工作台</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">没有匹配结果</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => { navigate(r.to); onClose() }}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === index && 'bg-accent/10')}
              >
                {typeIcon(r.type)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{r.title}</p>
                  <p className="truncate text-[11px] text-foreground-muted">{r.sub}</p>
                </div>
                <span className="shrink-0 text-[11px] text-foreground-muted">{TYPE_LABEL[r.type]}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-divider px-4 py-2 text-[11px] text-foreground-muted">
          <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> 打开</span>
          <span>上下选择</span>
          <span className="ml-auto">Esc 关闭</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
