/**
 * Build the package from two different absolute checkout paths and require
 * byte-identical committed artifacts. This guards against path-dependent IDs.
 */
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let failures = 0
function assert(condition, message) {
  if (!condition) {
    failures++
    console.error('FAIL:', message)
  } else {
    console.log('ok:', message)
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tsdownCli = join(root, 'node_modules', 'tsdown', 'dist', 'run.mjs')
const artifacts = ['index.js', 'client.js', 'client.js.map']

async function buildCheckout(directory) {
  await mkdir(directory, { recursive: true })
  for (const entry of ['src', 'package.json', 'tsconfig.json', 'tsdown.config.ts']) {
    await cp(join(root, entry), join(directory, entry), { recursive: true })
  }
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const result = spawnSync(process.execPath, [tsdownCli, '--config', './tsdown.config.ts'], {
    cwd: directory,
    encoding: 'utf8',
  })
  assert(result.status === 0, `build succeeds in ${basename(directory)}`)
  if (result.status !== 0) console.error(result.stderr || result.stdout)
  if (result.status !== 0) return null
  return Promise.all(artifacts.map((file) => readFile(join(directory, 'lib', file))))
}

const workRoot = resolve(root, 'output', 'build-determinism')
await mkdir(workRoot, { recursive: true })
const temporary = await mkdtemp(join(workRoot, 'checkouts-'))
try {
  const first = await buildCheckout(join(temporary, 'first-checkout'))
  const second = await buildCheckout(join(temporary, 'second-checkout'))
  if (first !== null && second !== null) {
    for (let index = 0; index < artifacts.length; index++) {
      assert(first[index].equals(second[index]), `${artifacts[index]} is byte-identical across checkout paths`)
    }
  }
} finally {
  if (dirname(resolve(temporary)) !== workRoot) throw new Error('Build cleanup escaped its workspace directory')
  await rm(temporary, { recursive: true, force: true })
}

console.log(failures === 0 ? 'BUILD DETERMINISM SPEC PASSED' : `${failures} BUILD DETERMINISM SPEC(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
