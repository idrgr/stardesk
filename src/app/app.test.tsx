import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { DataProvider } from './data-context'
import { EpochProvider } from './epoch-context'
import { SettingsProvider } from './settings-context'
import { ToastProvider } from '@/components/ui/Toast'
import { getDb } from '@/data/db/db'
import { updateSettings } from '@/data/repositories/settings'

// Provider 树必须与 src/main.tsx 保持一致。
function renderApp() {
  return render(
    <HashRouter>
      <DataProvider>
        <EpochProvider>
          <SettingsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SettingsProvider>
        </EpochProvider>
      </DataProvider>
    </HashRouter>,
  )
}

// 跳过首次启动引导，直接进入应用框架。
async function skipOnboarding() {
  const db = getDb('personal')
  await updateSettings(db, { onboardingCompleted: true })
}

// 应用外壳需要等懒加载的 DashboardPage chunk 完成转换，冷缓存或并行
// worker 下可能超过默认 1000ms，因此显式放宽等待时间（不放宽断言）。
const SHELL_TIMEOUT = 15000

async function waitForShell() {
  return screen.findByText('星枢 StarDesk', undefined, { timeout: SHELL_TIMEOUT })
}

describe('应用冒烟测试', () => {
  it('可挂载并渲染应用框架（品牌、导航分组）', async () => {
    await skipOnboarding()
    renderApp()
    await waitForShell()
    expect(screen.getByText('工作空间')).toBeInTheDocument()
    expect(screen.getByText('行动中心')).toBeInTheDocument()
    expect(screen.getByText('沉淀与回顾')).toBeInTheDocument()
  })

  it('四个内置领域在侧栏与领域卡中渲染', async () => {
    await skipOnboarding()
    renderApp()
    await waitForShell()
    expect((await screen.findAllByText('个人提升', undefined, { timeout: SHELL_TIMEOUT })).length).toBeGreaterThan(0)
    expect(screen.getAllByText('职业规划').length).toBeGreaterThan(0)
    expect(screen.getAllByText('兴趣爱好').length).toBeGreaterThan(0)
    expect(screen.getAllByText('运动健身').length).toBeGreaterThan(0)
  })
})
