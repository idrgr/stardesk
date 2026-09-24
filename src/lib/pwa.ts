/** 是否以「添加到主屏幕」后的 standalone / fullscreen 模式运行。 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)')
  if (mq.matches) return true
  // iOS Safari 旧版
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

/** 顶栏快捷键提示：Mac / iPad 外接键盘用 ⌘，Windows 用 Ctrl。 */
export function modifierKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl'
}
