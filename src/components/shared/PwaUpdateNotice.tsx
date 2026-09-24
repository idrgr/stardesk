import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'

/**
 * 检测到新版本 Service Worker 时提示用户手动刷新。
 * 不自动 reload，避免打断未保存的表单。
 */
export function PwaUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        registration.update().catch(() => {
          /* 离线或策略阻止时忽略 */
        })
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed z-[60] flex flex-wrap items-center justify-center gap-3 border-b border-accent/30 bg-surface-raised/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur-sm sd-safe-top sd-safe-x"
      style={{
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <span>StarDesk 有新版本，重新加载后更新。</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setNeedRefresh(false)}>
          稍后
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            void updateServiceWorker(true)
          }}
        >
          重新加载
        </Button>
      </div>
    </div>
  )
}
