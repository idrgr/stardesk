import { useEffect, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useData } from './data-context'
import { useSettings } from './settings-context'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'
import { ensureBuiltinModules } from '@/data/repositories/modules'
import { ensureSettings } from '@/data/repositories/settings'
import { seedDemo } from '@/data/demo/seed'
import { deviceTimeZone } from '@/data/db/defaults'

// 按路由拆包，图表、Markdown 预览等重依赖随路由按需加载。
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ActionsPage = lazy(() => import('@/features/actions/ActionsPage').then((m) => ({ default: m.ActionsPage })))
const ModulePage = lazy(() => import('@/features/modules/ModulePage').then((m) => ({ default: m.ModulePage })))
const KnowledgePage = lazy(() => import('@/features/knowledge/KnowledgePage').then((m) => ({ default: m.KnowledgePage })))
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage').then((m) => ({ default: m.ReviewsPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ModuleCenterPage = lazy(() => import('@/features/module-center/ModuleCenterPage').then((m) => ({ default: m.ModuleCenterPage })))

/** 本地数据库初始化期间的启动占位，避免闪现未就绪的界面。 */
function BootSplash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="stardesk-backdrop" aria-hidden="true" />
      <div className="relative flex items-center gap-2 text-sm text-foreground-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        正在读取本地数据…
      </div>
    </div>
  )
}

export default function App() {
  const { db, space } = useData()
  const { settings } = useSettings()

  useEffect(() => {
    void (async () => {
      await ensureBuiltinModules(db)
      await ensureSettings(db)
      if (space === 'demo') {
        await seedDemo(db, deviceTimeZone())
      }
    })().catch((e) => {
      console.error('初始化失败', e)
    })
  }, [db, space])

  // 设置尚未读取完成时不要先渲染工作台外壳：
  // 否则首次启动会先闪一下工作台，再被弹回引导页（且外壳上的按钮短暂可点）。
  if (!settings) {
    return <BootSplash />
  }

  if (space === 'personal' && !settings.onboardingCompleted) {
    return <OnboardingScreen />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/modules/:moduleId" element={<ModulePage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/module-center" element={<ModuleCenterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
