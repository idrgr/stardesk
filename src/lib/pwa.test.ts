import { describe, expect, it } from 'vitest'
import { modifierKeyLabel } from './pwa'

describe('pwa helpers', () => {
  it('modifierKeyLabel 返回字符串', () => {
    expect(typeof modifierKeyLabel()).toBe('string')
    expect(['Ctrl', '⌘']).toContain(modifierKeyLabel())
  })
})
