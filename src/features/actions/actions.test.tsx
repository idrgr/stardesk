import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from '@/app/data-context'
import { SettingsProvider } from '@/app/settings-context'
import { ToastProvider } from '@/components/ui/Toast'
import { ActionsPage } from './ActionsPage'

function renderActions() {
  return render(
    <MemoryRouter initialEntries={['/actions']}>
      <DataProvider>
        <SettingsProvider>
          <ToastProvider>
            <Routes>
              <Route path="/actions" element={<ActionsPage />} />
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </DataProvider>
    </MemoryRouter>,
  )
}

describe('行动中心页签', () => {
  it('默认展示任务页签并可切换到目标/项目/习惯/日程', async () => {
    renderActions()
    // 五个页签
    expect(await screen.findByText('任务')).toBeInTheDocument()
    expect(screen.getByText('目标')).toBeInTheDocument()
    expect(screen.getByText('项目')).toBeInTheDocument()
    expect(screen.getByText('习惯')).toBeInTheDocument()
    expect(screen.getByText('日程')).toBeInTheDocument()

    // 切换到目标页签
    await userEvent.click(screen.getByText('目标'))
    expect((await screen.findAllByText('新增目标')).length).toBeGreaterThan(0)

    // 切换到习惯页签
    await userEvent.click(screen.getByText('习惯'))
    expect((await screen.findAllByText('新增习惯')).length).toBeGreaterThan(0)
  })
})
