/**
 * 开发环境触控 / resume 诊断（?debugTouch=1，生产默认关闭）。
 */

import { findSuspiciousOverlays } from './app-resume'

let enabled = false

function isEnabled(): boolean {
  if (enabled) return true
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('debugTouch')
    if (q === '1' || q === 'true') {
      enabled = true
      return true
    }
    if (window.localStorage.getItem('stardesk.debugTouch') === '1') {
      enabled = true
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function meta(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return {
    ts: Date.now(),
    visibility: document.visibilityState,
    standalone: nav.standalone ?? null,
    ...extra,
  }
}

function log(kind: string, extra: Record<string, unknown> = {}): void {
  if (!isEnabled()) return
  console.info(`[StarDesk touch] ${kind}`, meta(extra))
}

function describeTarget(t: EventTarget | null): Record<string, unknown> {
  if (!(t instanceof HTMLElement)) return { target: String(t) }
  return {
    tag: t.tagName.toLowerCase(),
    id: t.id || null,
    class: t.className?.toString().slice(0, 80) || null,
  }
}

/** 应用入口调用。 */
export function initTouchDebug(): void {
  if (typeof window === 'undefined' || !isEnabled()) return

  log('debug enabled')

  window.addEventListener('pageshow', (ev) => {
    log('pageshow', { persisted: ev.persisted })
  })
  window.addEventListener('pagehide', () => log('pagehide'))
  document.addEventListener('visibilitychange', () => {
    log('visibilitychange', { state: document.visibilityState })
  })
  window.addEventListener('focus', () => log('focus'))
  window.addEventListener('blur', () => log('blur'))

  window.addEventListener(
    'pointerdown',
    (ev) => {
      log('pointerdown', describeTarget(ev.target))
    },
    { capture: true },
  )

  window.addEventListener(
    'click',
    (ev) => {
      log('click', describeTarget(ev.target))
    },
    { capture: true },
  )

  let lastPointer: { x: number; y: number } | null = null
  window.addEventListener(
    'pointerdown',
    (ev) => {
      lastPointer = { x: ev.clientX, y: ev.clientY }
      window.setTimeout(() => {
        lastPointer = null
      }, 800)
    },
    { capture: true },
  )

  window.addEventListener(
    'pointerup',
    (ev) => {
      if (!lastPointer) return
      const top = document.elementFromPoint(ev.clientX, ev.clientY)
      const stack = document.elementsFromPoint(ev.clientX, ev.clientY).slice(0, 5)
      log('elementFromPoint', {
        x: ev.clientX,
        y: ev.clientY,
        top: describeTarget(top),
        stack: stack.map((el) =>
          el instanceof HTMLElement
            ? {
                tag: el.tagName.toLowerCase(),
                class: el.className?.toString().slice(0, 60),
                pe: getComputedStyle(el).pointerEvents,
                opacity: getComputedStyle(el).opacity,
                z: getComputedStyle(el).zIndex,
              }
            : el,
        ),
        overlays: findSuspiciousOverlays().slice(0, 5),
      })
    },
    { capture: true },
  )
}
