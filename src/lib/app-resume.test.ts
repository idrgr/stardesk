import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initAppResume, subscribeAppResume } from './app-resume'
import { dismissAllTransientUi, registerTransientUiDismiss } from './transient-ui'
import { clearDocumentInteractionLocks } from './document-interaction'

describe('app resume recovery', () => {
  beforeEach(() => {
    clearDocumentInteractionLocks()
    document.body.style.overflow = 'hidden'
    document.documentElement.style.pointerEvents = 'none'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    clearDocumentInteractionLocks()
    document.body.style.removeProperty('overflow')
    document.documentElement.style.removeProperty('pointer-events')
  })

  it('pageshow persisted 清理 body 锁并 dismiss 短暂 UI', () => {
    const dismiss = vi.fn()
    registerTransientUiDismiss(dismiss)
    initAppResume()
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.pointerEvents).toBe('')
    expect(dismiss).toHaveBeenCalled()
  })

  it('subscribeAppResume 收到 persisted 标记', () => {
    const heard = vi.fn()
    initAppResume()
    subscribeAppResume(heard)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ persisted: true, reason: 'pageshow' }))
  })
})

describe('transient ui dismiss', () => {
  it('dismissAllTransientUi 调用所有注册项', () => {
    const a = vi.fn()
    const b = vi.fn()
    const off = registerTransientUiDismiss(a)
    registerTransientUiDismiss(b)
    dismissAllTransientUi()
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
    off()
  })
})
