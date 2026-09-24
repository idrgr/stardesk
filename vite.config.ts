import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** GitHub Project Pages 子路径；本地 dev / 默认 build 仍为根路径 `/`。 */
const githubPages =
  process.env.GITHUB_PAGES === 'true' || process.env.GITHUB_PAGES === '1'
const base = githubPages ? '/stardesk/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: '星枢 StarDesk',
        short_name: 'StarDesk',
        description: '星枢 StarDesk：本地优先的个人工作台',
        // 相对 manifest 所在目录（/stardesk/），兼容 Project Pages 与本地根路径 build
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        lang: 'zh-CN',
        background_color: '#080d16',
        theme_color: '#080d16',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // 测试产物写入项目根目录时不应触发 dev server 整页重载。
      ignored: [
        '**/test-results/**',
        '**/e2e-report/**',
        '**/e2e-evidence/**',
        '**/e2e-results.json',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    globals: true,
  },
})
