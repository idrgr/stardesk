import { NavLink } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LayoutDashboard,
  ListTodo,
  Library,
  CalendarCheck,
  LayoutGrid,
  Settings as SettingsIcon,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { listEnabledModules } from '@/data/repositories/modules'
import { getIcon } from '@/modules/registry'
import { cn } from '@/lib/cn'

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  onNavigate,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-foreground-secondary hover:bg-surface hover:text-foreground',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-6 bg-divider" />
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
      {children}
    </p>
  )
}

export function Sidebar({
  collapsed,
  onToggle,
  showCollapseToggle = true,
  onNavigate,
}: {
  collapsed: boolean
  onToggle: () => void
  showCollapseToggle?: boolean
  onNavigate?: () => void
}) {
  const { db } = useData()
  const { settings } = useSettings()
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []

  const nickname = settings?.nickname?.trim() || '未设置昵称'

  return (
    <aside
      aria-label="侧栏"
      className={cn(
        'flex h-full flex-col border-r border-divider bg-surface/40 transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[232px]',
      )}
    >
      {/* 品牌 */}
      <div className={cn('flex items-center gap-2.5 px-4 py-4', collapsed && 'justify-center px-0')}>
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Sparkles className="h-[18px] w-[18px]" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">星枢 StarDesk</p>
            <p className="text-[11px] text-foreground-muted">个人工作台</p>
          </div>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <GroupLabel collapsed={collapsed}>工作空间</GroupLabel>
        <div className="space-y-0.5">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="总览" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem to="/actions" icon={ListTodo} label="行动中心" collapsed={collapsed} onNavigate={onNavigate} />
        </div>

        <GroupLabel collapsed={collapsed}>我的领域</GroupLabel>
        <div className="space-y-0.5">
          {modules.map((m) => {
            const Icon = getIcon(m.iconKey)
            return (
              <NavItem
                key={m.id}
                to={`/modules/${m.id}`}
                icon={Icon}
                label={m.name}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )
          })}
        </div>

        <GroupLabel collapsed={collapsed}>沉淀与回顾</GroupLabel>
        <div className="space-y-0.5">
          <NavItem to="/knowledge" icon={Library} label="知识库" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem to="/reviews" icon={CalendarCheck} label="周期复盘" collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      </nav>

      {/* 底部固定区域 */}
      <div className="border-t border-divider px-3 py-3">
        <div className="space-y-0.5">
          <NavItem to="/module-center" icon={LayoutGrid} label="模块中心" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem to="/settings" icon={SettingsIcon} label="设置与数据" collapsed={collapsed} onNavigate={onNavigate} />
        </div>
        {!collapsed ? (
          <div className="mt-3 flex items-center gap-2 px-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-accent">
              {nickname.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-foreground">{nickname}</p>
              <p className="truncate text-[11px] text-foreground-muted">本地工作空间</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-accent">
              {nickname.slice(0, 1).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* 折叠开关 */}
      {showCollapseToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
          className="flex h-10 items-center justify-center border-t border-divider text-foreground-muted transition-colors hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}
    </aside>
  )
}
