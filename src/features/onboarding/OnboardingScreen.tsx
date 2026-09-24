import { Sparkles, Rocket, CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'

/** 首次启动选择：创建空白工作台 或 进入演示空间。 */
export function OnboardingScreen() {
  const { switchSpace } = useData()
  const { update } = useSettings()

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-y-auto p-6">
      <div className="stardesk-backdrop" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">欢迎使用星枢 StarDesk</h1>
          <p className="mt-2 text-sm text-foreground-secondary">把长期方向拆成近期计划，把计划落实为今日行动。</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => update({ onboardingCompleted: true })}
            className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/50"
          >
            <CirclePlus className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium text-foreground">创建我的空白工作台</p>
              <p className="mt-0.5 text-xs text-foreground-muted">从零开始，数据保存在这个浏览器中。</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchSpace('demo')}
            className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/50"
          >
            <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-accent-secondary" />
            <div>
              <p className="text-sm font-medium text-foreground">进入演示空间</p>
              <p className="mt-0.5 text-xs text-foreground-muted">体验已有数据的完整工作台，随时可以重置。</p>
            </div>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-foreground-muted">
          数据保存在这个浏览器中。更换浏览器、设备或访问地址前，请先导出备份。
        </p>
      </div>
    </div>
  )
}
