/**
 * 短暂 UI（抽屉、搜索、弹窗）在 PWA 从后台恢复时应关闭，避免透明 overlay 挡住触控。
 * 不用于业务表单草稿或路由状态。
 */

const dismissHandlers = new Set<() => void>()

export function registerTransientUiDismiss(handler: () => void): () => void {
  dismissHandlers.add(handler)
  return () => {
    dismissHandlers.delete(handler)
  }
}

/** 关闭所有已注册的短暂 UI（由各组件自行决定关什么）。 */
export function dismissAllTransientUi(): void {
  for (const fn of dismissHandlers) {
    try {
      fn()
    } catch {
      /* 忽略单个 handler 失败 */
    }
  }
}
