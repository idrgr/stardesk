import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { TasksView } from './TasksView'
import { GoalsView } from './GoalsView'
import { ProjectsView } from './ProjectsView'
import { HabitsView } from './HabitsView'
import { ScheduleView } from './ScheduleView'

type Tab = 'tasks' | 'goals' | 'projects' | 'habits' | 'schedule'

const TABS: { key: Tab; label: string }[] = [
  { key: 'tasks', label: '任务' },
  { key: 'goals', label: '目标' },
  { key: 'projects', label: '项目' },
  { key: 'habits', label: '习惯' },
  { key: 'schedule', label: '日程' },
]

export function ActionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) || 'tasks'

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">行动中心</h1>
        <p className="text-sm text-foreground-muted">把方向拆成行动，把行动落实成今天</p>
      </div>

      <div className="flex gap-1 border-b border-divider">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'relative px-4 py-2 text-sm transition-colors',
              tab === t.key
                ? 'text-accent'
                : 'text-foreground-secondary hover:text-foreground',
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {tab === 'tasks' && <TasksView />}
      {tab === 'goals' && <GoalsView />}
      {tab === 'projects' && <ProjectsView />}
      {tab === 'habits' && <HabitsView />}
      {tab === 'schedule' && <ScheduleView />}
    </div>
  )
}
