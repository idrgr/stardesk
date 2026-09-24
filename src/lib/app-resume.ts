/**
 * PWA / iPadOS 从后台恢复时的集中处理（pageshow BFCache、visibilitychange）。
 */

import { restoreDocumentInteraction } from './document-interaction'
import { dismissAllTransientUi } from './transient-ui'

export type AppResumeReason = 'pageshow' | 'visibility'

export interface AppResumeDetail {
  reason: AppResumeReason
  persisted: boolean
}

type ResumeListener = (detail: AppResumeDetail) => void

const listeners = new Set<ResumeListener>()
let epochRefresher: (() => void) | null = null
let installed = false

export function setEpochResumeRefresher(fn: (() => void) | null): void {
  epochRefresher = fn
}

export function subscribeAppResume(listener: ResumeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(detail: AppResumeDetail): void {
  for (const fn of listeners) fn(detail)
}

function runRecovery(detail: AppResumeDetail): void {
  restoreDocumentInteraction()
  dismissAllTransientUi()
  epochRefresher?.()

  requestAnimationFrame(() => {
    restoreDocumentInteraction()
    if (detail.persisted) {
      dismissAllTransientUi()
    }
  })

  emit(detail)
}

function onVisible(reason: AppResumeReason, persisted = false): void {
  if (typeof document === 'undefined') return
  if (document.visibilityState !== 'visible') return
  runRecovery({ reason, persisted })
}

/** 在应用入口调用一次。 */
export function initAppResume(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('pageshow', (ev) => {
    onVisible('pageshow', ev.persisted)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onVisible('visibility', false)
    }
  })

  window.addEventListener('pagehide', () => {
    restoreDocumentInteraction()
  })
}

/** 调试：列出可能挡住点击的 fixed 层。 */
export function findSuspiciousOverlays(): Array<{
  tag: string
  className: string
  pointerEvents: string
  opacity: string
  visibility: string
  zIndex: string
}> {
  if (typeof document === 'undefined') return []
  const out: ReturnType<typeof findSuspiciousOverlays> = []
  const all = document.querySelectorAll('body *')
  for (const el of all) {
    if (!(el instanceof HTMLElement)) continue
    const style = getComputedStyle(el)
    if (style.position !== 'fixed') continue
    const z = Number.parseInt(style.zIndex, 10)
    if (Number.isNaN(z) || z < 40) continue
    if (style.pointerEvents === 'none') continue
    out.push({
      tag: el.tagName.toLowerCase(),
      className: el.className.slice(0, 120),
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      visibility: style.visibility,
      zIndex: style.zIndex,
    })
  }
  return out
}
