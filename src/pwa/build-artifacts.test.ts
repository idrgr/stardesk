import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const dist = join(process.cwd(), 'dist')
const manifestPath = join(dist, 'manifest.webmanifest')
const swPath = join(dist, 'sw.js')

describe('PWA 生产构建产物', () => {
  beforeAll(() => {
    if (!existsSync(manifestPath) || !existsSync(swPath)) {
      execSync('npm run build', { stdio: 'inherit' })
    }
  }, 120_000)

  it('生成 manifest.webmanifest 且字段正确', () => {
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string
      short_name: string
      display: string
      lang: string
      orientation: string
    }
    expect(manifest.name).toBe('星枢 StarDesk')
    expect(manifest.short_name).toBe('StarDesk')
    expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('zh-CN')
    expect(manifest.orientation).toBe('any')
  })

  it('生成 service worker 文件', () => {
    expect(existsSync(swPath)).toBe(true)
    const sw = readFileSync(swPath, 'utf8')
    expect(sw.length).toBeGreaterThan(100)
  })

  it('index.html 引用 manifest', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(html).toContain('manifest.webmanifest')
  })
})
