import { useLocation } from 'react-router-dom'
import type { RefObject } from 'react'
import { Menu, Moon, Plus, Search, Sun, Monitor, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/Spinner'
import { useSettings } from '@/app/settings-context'
import { todayInTimeZone, formatDateFullZh } from '@/lib/date'
import type { Theme } from '@/domain/enums'

const SECTION_TITLE: Record<string, string> = {
  '/dashboard': '总览',
  '/actions': '行动中心',
  '/knowledge': '知识库',
  '/reviews': '周期复盘',
  '/module-center': '模块中心',
  '/settings': '设置与数据',
}

function titleForPath(path: string): string {
  if (path.startsWith('/modules/')) return '领域'
  for (const [prefix, title] of Object.entries(SECTION_TITLE)) {
    if (path === prefix || path.startsWith(prefix)) return title
  }
  return '星枢 StarDesk'
}

const THEME_NEXT: Record<Theme, Theme> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') return <Moon className="h-4 w-4" />
  if (theme === 'light') return <Sun className="h-4 w-4" />
  return <Monitor className="h-4 w-4" />
}

export function Topbar({
  quickAddButtonRef,
  onOpenMobileNav,
  onQuickAdd,
  onSearch,
  onFocus,
}: {
  quickAddButtonRef?: RefObject<HTMLButtonElement | null>
  onOpenMobileNav: () => void
  onQuickAdd: () => void
  onSearch: () => void
  onFocus: () => void
}) {
  const location = useLocation()
  const { settings, update } = useSettings()
  const theme = settings?.theme ?? 'dark'
  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const today = todayInTimeZone(timeZone)

  const cycleTheme = () => {
    const next = THEME_NEXT[theme]
    void update({ theme: next })
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-divider bg-surface/30 px-4 backdrop-blur-sm md:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="打开导航"
        className="rounded-lg p-2 text-foreground-secondary hover:bg-surface md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{titleForPath(location.pathname)}</p>
        <p className="hidden text-[11px] text-foreground-muted sm:block">
          {formatDateFullZh(today)}
        </p>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground-muted transition-colors hover:border-foreground-secondary/50 sm:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">搜索</span>
        <span className="flex items-center gap-0.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <button
        type="button"
        onClick={onSearch}
        aria-label="搜索"
        className="rounded-lg p-2 text-foreground-secondary hover:bg-surface sm:hidden"
      >
        <Search className="h-5 w-5" />
      </button>

      <Button ref={quickAddButtonRef} onClick={onQuickAdd} variant="primary" size="sm" aria-label="快速新增">
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">快速新增</span>
      </Button>

      <button
        type="button"
        onClick={onFocus}
        aria-label="专注"
        title="专注"
        className="rounded-lg p-2 text-foreground-secondary hover:bg-surface"
      >
        <Timer className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`切换主题（当前：${theme}）`}
        title="切换主题"
        className="rounded-lg p-2 text-foreground-secondary hover:bg-surface"
      >
        <ThemeIcon theme={theme} />
      </button>

      <div
        className="hidden items-center gap-1.5 text-[11px] text-foreground-muted lg:flex"
        title="数据保存在本浏览器（IndexedDB），未上传云端"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        本地保存
      </div>
    </header>
  )
}
