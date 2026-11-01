import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const workRoot = resolve(process.env.DSH_TEST_WORKSPACE ?? (
  process.platform === 'win32' ? 'E:\\Codex\\Workspace\\dsh-effort-slider-20261101' : join(root, 'output')
))
export const processTemp = process.platform === 'win32' ? 'E:\\Codex\\Temp' : join(workRoot, 'process-temp')
