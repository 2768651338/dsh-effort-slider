/**
 * Keep the package identity used by DSH's bundle patch in sync with npm.
 * Run with: node test/package-config.spec.mjs
 */
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'

let failures = 0
function assert(condition, message) {
  if (!condition) {
    failures++
    console.error('FAIL:', message)
  } else {
    console.log('ok:', message)
  }
}

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const patch = parse(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'))
const patchNames = patch.flatMap((operation) => operation.insert ?? []).map((entry) => entry.name)

assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'package.json declares a package name')
assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'DSH bundle points to cordis.patch.yml')
assert(patchNames.length === 1, 'cordis.patch.yml declares exactly one plugin package name')
assert(patchNames[0] === manifest.name, 'cordis patch package name matches package.json')

console.log(failures === 0 ? 'PACKAGE CONFIG SPEC PASSED' : `${failures} PACKAGE CONFIG SPEC(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
