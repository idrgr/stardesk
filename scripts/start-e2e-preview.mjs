/**
 * 为 PWA E2E 启动生产 preview（先 build，再监听 5200）。
 * Playwright webkit-ipad-pwa 项目通过此脚本拉起服务。
 */
import { execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

execSync(`"${node}" "${vite}" build`, { cwd: root, stdio: 'inherit' })

const child = spawn(
  node,
  [vite, 'preview', '--port', '5200', '--strictPort', '--host', '127.0.0.1'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
)

const shutdown = () => {
  child.kill('SIGTERM')
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
