/**
 * 从 public/favicon.svg 生成本地 PWA / Apple 触控图标（不依赖外网）。
 * 运行：node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/favicon.svg'))

const sizes = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const buf = await sharp(svg).resize(size, size).png().toBuffer()
  writeFileSync(join(root, 'public', name), buf)
  console.log('wrote', name)
}
