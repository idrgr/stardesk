import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataProvider } from '@/app/data-context'
import { EpochProvider } from '@/app/epoch-context'
import { SettingsProvider } from '@/app/settings-context'
import { ToastProvider } from '@/components/ui/Toast'
import { ReviewsPage } from './ReviewsPage'
import { getDb } from '@/data/db/db'
import { ensureSettings } from '@/data/repositories/settings'
import { ensureBuiltinModules } from '@/data/repositories/modules'

function renderReviews() {
  return render(
    <DataProvider>
      <EpochProvider>
        <SettingsProvider>
          <ToastProvider>
            <ReviewsPage />
          </ToastProvider>
        </SettingsProvider>
      </EpochProvider>
    </DataProvider>,
  )
}

describe('周期复盘：下一周期行动', () => {
  it('转换后仍保留用户输入的行动，重复转换不会重复创建任务', async () => {
    const db = getDb('personal')
    await ensureBuiltinModules(db)
    await ensureSettings(db)

    renderReviews()

    // 添加一条行动并填写
    await userEvent.click(await screen.findByRole('button', { name: '添加' }))
    const titleInput = await screen.findByLabelText('行动标题')
    await userEvent.type(titleInput, '每天练习 30 分钟')

    const convertButton = screen.getByRole('button', { name: '转换为任务' })
    await waitFor(() => expect(convertButton).toBeEnabled())
    await userEvent.click(convertButton)

    // 创建任务
    await waitFor(async () => {
      const tasks = await db.tasks.toArray()
      expect(tasks.filter((t) => t.title === '每天练习 30 分钟')).toHaveLength(1)
    })

    // 关键回归：转换后用户输入的行动行不能被清空
    await waitFor(() => {
      expect(screen.getByLabelText('行动标题')).toHaveValue('每天练习 30 分钟')
    })

    // 再次转换：不重复创建
    await userEvent.click(screen.getByRole('button', { name: '转换为任务' }))
    await waitFor(async () => {
      const tasks = await db.tasks.toArray()
      expect(tasks.filter((t) => t.title === '每天练习 30 分钟')).toHaveLength(1)
    })
  })
})
