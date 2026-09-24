import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataProvider } from '@/app/data-context'
import { SettingsProvider } from '@/app/settings-context'
import { ToastProvider } from '@/components/ui/Toast'
import type { ModuleConfig } from '@/domain/entities'
import { GrowthOverview } from './GrowthOverview'
import { CareerOverview } from './CareerOverview'
import { HobbiesOverview } from './HobbiesOverview'
import { FitnessOverview } from './FitnessOverview'

function makeModule(key: string): ModuleConfig {
  return {
    id: `mod-${key}`,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    definitionKey: key,
    name: '领域',
    description: '',
    iconKey: 'layers',
    colorKey: 'growth',
    order: 0,
    enabled: true,
    capabilities: ['goals', 'projects', 'tasks', 'habits', 'notes', 'activities'],
    archivedAt: null,
  }
}

function renderWith(ui: React.ReactNode) {
  return render(
    <DataProvider>
      <SettingsProvider>
        <ToastProvider>{ui}</ToastProvider>
      </SettingsProvider>
    </DataProvider>,
  )
}

describe('四个领域概览', () => {
  it('个人提升渲染学习记录与技能自评', async () => {
    renderWith(<GrowthOverview module={makeModule('growth')} />)
    expect(await screen.findByText('记录学习')).toBeInTheDocument()
    expect(screen.getByText('学习目标')).toBeInTheDocument()
    expect(screen.getByText('技能自评')).toBeInTheDocument()
  })

  it('职业规划渲染能力清单', async () => {
    renderWith(<CareerOverview module={makeModule('career')} />)
    expect(await screen.findByText('新增能力项')).toBeInTheDocument()
    expect(screen.getByText('能力清单（当前 → 目标）')).toBeInTheDocument()
  })

  it('兴趣爱好渲染实践记录', async () => {
    renderWith(<HobbiesOverview module={makeModule('hobbies')} />)
    expect(await screen.findByText('记录实践')).toBeInTheDocument()
    expect(screen.getByText('兴趣项目')).toBeInTheDocument()
  })

  it('运动健身渲染训练统计', async () => {
    renderWith(<FitnessOverview module={makeModule('fitness')} />)
    expect(await screen.findByText('记录训练')).toBeInTheDocument()
    expect(screen.getByText('本周训练次数')).toBeInTheDocument()
    expect(screen.getByText('体重记录（可选）')).toBeInTheDocument()
  })
})
