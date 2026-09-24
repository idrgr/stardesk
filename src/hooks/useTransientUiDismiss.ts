import { useEffect } from 'react'
import { registerTransientUiDismiss } from '@/lib/transient-ui'

/** 在 app resume 时关闭本组件的短暂 overlay（抽屉/弹窗等）。 */
export function useTransientUiDismiss(dismiss: () => void, active = true): void {
  useEffect(() => {
    if (!active) return
    return registerTransientUiDismiss(dismiss)
  }, [dismiss, active])
}
