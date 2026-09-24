/**
 * 文档级交互锁（overflow / pointer-events 等）的统一清理。
 * Dialog 等组件若将来加 scroll lock，应通过 acquire/release 配对。
 */

const STYLE_KEYS = [
  'overflow',
  'overflowX',
  'overflowY',
  'pointerEvents',
  'touchAction',
  'userSelect',
  'position',
] as const

const locks = new Set<string>()

export function acquireInteractionLock(id: string): void {
  locks.add(id)
}

export function releaseInteractionLock(id: string): void {
  locks.delete(id)
}

function cssPropertyName(camel: string): string {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase()
}

function clearInlineInteractionStyles(el: HTMLElement): void {
  for (const key of STYLE_KEYS) {
    el.style.removeProperty(cssPropertyName(key))
  }
}

/** 清除 body/html 上可能残留的 inline 交互锁（不依赖组件是否仍 mounted）。 */
export function clearDocumentInteractionLocks(): void {
  if (typeof document === 'undefined') return
  clearInlineInteractionStyles(document.body)
  clearInlineInteractionStyles(document.documentElement)
}

/**
 * 在 resume 后执行：清 inline 锁 + 若仍有注册的 lock 则再清一次（防御性）。
 */
export function restoreDocumentInteraction(): void {
  clearDocumentInteractionLocks()
  if (locks.size > 0) {
    clearDocumentInteractionLocks()
  }
}

export function getInteractionLockDebugState(): { activeLocks: string[] } {
  return { activeLocks: [...locks] }
}
