/**
 * Keep the package identity used by DSH's bundle patch in sync with npm.
 * Run with: node test/package-config.spec.mjs
 */
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import ts from 'typescript'

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

// Parse the shipped JavaScript with the compiler, rather than trusting the
// build config: npm 0.5.1 shipped a stale, unscoped factory despite its manifest.
const client = ts.createSourceFile('client.js',
  await readFile(process.argv[2] ?? new URL('../lib/client.js', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
assert(client.parseDiagnostics.length === 0, 'shipped client is valid JavaScript')
const registrations = []
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(client) === 'window.__ModuleLoader__.load') {
    registrations.push(node)
  }
  ts.forEachChild(node, visit)
}
visit(client)
assert(registrations.length === 1, 'shipped client registers exactly one module factory')
const registration = registrations[0]?.arguments[0]
const id = registration && ts.isObjectLiteralExpression(registration)
  ? registration.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText(client) === 'id')?.initializer
  : undefined
assert(id !== undefined && ts.isStringLiteral(id) && id.text === manifest.name,
  'shipped client factory id matches the scoped npm package name')
assert(manifest.scripts.prepack?.includes('build') && manifest.scripts.prepack?.includes('package-config.spec.mjs'),
  'packing rebuilds and validates the actual shipped client')

console.log(failures === 0 ? 'PACKAGE CONFIG SPEC PASSED' : `${failures} PACKAGE CONFIG SPEC(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
