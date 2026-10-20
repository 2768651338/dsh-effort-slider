/**
 * Build the package from two different absolute checkout paths and require
 * byte-identical committed artifacts. This guards against path-dependent IDs.
 */
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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

async function normalizeSourceLineEndings(directory, newline) {
  const sourceRoot = join(directory, 'src')
  for (const entry of await readdir(sourceRoot, { recursive: true })) {
    if (!/\.(?:css|tsx?)$/.test(entry)) continue
    const filePath = join(sourceRoot, entry)
    const source = await readFile(filePath, 'utf8')
    await writeFile(filePath, source.replace(/\r?\n/g, newline))
  }
}

async function buildFixture(directory, newline) {
  await cp(root, directory, {
    recursive: true,
    filter: (source) => !['.git', 'node_modules'].includes(basename(source)),
  })
  await normalizeSourceLineEndings(directory, newline)
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

const temporary = await mkdtemp(join(tmpdir(), 'dsh-effort-slider-determinism-'))
try {
  const first = await buildFixture(join(temporary, 'lf-checkout'), '\n')
  const second = await buildFixture(join(temporary, 'crlf-checkout'), '\r\n')
  if (first !== null && second !== null) {
    for (let index = 0; index < artifacts.length; index++) {
      assert(first[index].equals(second[index]), `${artifacts[index]} is byte-identical across checkout paths`)
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}

console.log(failures === 0 ? 'BUILD DETERMINISM SPEC PASSED' : `${failures} BUILD DETERMINISM SPEC(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
