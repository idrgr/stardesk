import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
execSync('npm run build', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, GITHUB_PAGES: '1' },
})
