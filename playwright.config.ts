import { defineConfig, devices } from '@playwright/test'

const PORT = 5199
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Playwright 配置。
 *
 * 环境说明（本机实测）：
 * - 使用系统已安装的 Microsoft Edge（`channel: 'msedge'`），不下载 Playwright 自带浏览器。
 * - webServer 直接用当前 Node 可执行文件运行 Vite，绕开本机 Git Bash 下 npm 的 fnm 环境问题。
 * - 每个测试使用独立的 browser context，因此 IndexedDB 相互隔离（个人空间首次启动会显示引导页）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e-report' }],
    ['json', { outputFile: 'e2e-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'msedge-desktop',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
