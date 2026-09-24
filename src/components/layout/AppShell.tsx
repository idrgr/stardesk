import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TaskFormDialog } from '@/features/actions/TaskFormDialog'
import { SearchPalette } from '@/features/search/SearchPalette'
import { FocusPanel } from '@/features/focus/FocusPanel'
import { EpochNotice } from '@/components/shared/EpochNotice'
import { Dialog } from '@/components/ui/Dialog'
import { useData } from '@/app/data-context'
import { useEpoch } from '@/app/epoch-context'
import { useLocalStorage } from '@/lib/useLocalStorage'

export function AppShell() {
  const { space, switchSpace } = useData()
  const { isStale } = useEpoch()
  const [collapsed, setCollapsed] = useLocalStorage('stardesk.sidebar.collapsed', false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const quickAddButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  // Ctrl/Cmd + K 打开搜索；输入框/编辑器获得焦点时不抢占。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const el = e.target as HTMLElement | null
        if (
          el &&
          (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.tagName === 'SELECT' ||
            el.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 移动端导航后自动关闭抽屉。
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  // 数据空间被其他标签页替换后，旧的专注面板（运行中/暂停会话）已失效：
  // 关闭它，避免用户在一个已作废的会话上继续操作。
  useEffect(() => {
    if (isStale) setFocusOpen(false)
  }, [isStale])

  return (
    <div className="flex h-full">
      {/* 桌面侧栏 */}
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* 移动端抽屉导航 */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[260px] shadow-2xl">
            <Sidebar collapsed={false} onToggle={() => undefined} showCollapseToggle={false} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <EpochNotice />
        {space === 'demo' && (
          <div className="flex items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-warning">
            <span>演示空间 · 示例数据可随时重置，个人空间不受影响</span>
            <button type="button" onClick={() => switchSpace('personal')} className="underline hover:opacity-80">
              回到个人空间
            </button>
          </div>
        )}
        <Topbar
          quickAddButtonRef={quickAddButtonRef}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onQuickAdd={() => setQuickAddOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onFocus={() => setFocusOpen(true)}
        />
        <main className="relative flex-1 overflow-y-auto">
          <div className="stardesk-backdrop" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1560px] px-4 py-6 md:px-7 lg:px-8">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24 text-sm text-foreground-muted">
                  加载中…
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <TaskFormDialog
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false)
          queueMicrotask(() => quickAddButtonRef.current?.focus())
        }}
      />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Dialog open={focusOpen} onClose={() => setFocusOpen(false)} title="专注" width="max-w-sm">
        <FocusPanel />
      </Dialog>
    </div>
  )
}
