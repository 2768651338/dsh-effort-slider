/** Launch the published DSH app, install this package, and operate its real browser UI. */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { parse, stringify } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workRoot = join(root, 'output', 'live-dsh')
await mkdir(workRoot, { recursive: true })
const runRoot = await mkdtemp(join(workRoot, 'run-'))
const runtimeRoot = join(root, 'output', 'release', 'runtime')
const runtimeBin = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const processTemp = join(runRoot, 'process-temp')
await mkdir(processTemp)
const env = { ...process.env, DSH_HOME: join(runRoot, 'home'), TEMP: processTemp, TMP: processTemp, TMPDIR: processTemp }
for (const key of Object.keys(env)) {
  if (/(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD)$/.test(key)) delete env[key]
}

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8', timeout: 600000, ...options })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${executable} failed: ${result.stderr || result.stdout}`)
}

if (!existsSync(runtimeBin)) {
  console.log('Installing published DSH 0.2.1-rc.2 into output/release/runtime')
  command('npm', ['install', '--prefix', 'output/release/runtime', '--no-save', '--no-audit', '--no-fund',
    '@deepseek-ai/dsh@0.2.1-rc.2', '@deepseek-ai/dsh-llm-pi-ai@0.2.1-rc.2', '--registry=https://registry.npmjs.org'],
  { shell: process.platform === 'win32' })
}
const runtimeManifest = JSON.parse(await readFile(join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8'))
assert.equal(runtimeManifest.version, '0.2.1-rc.2')
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
console.log('Installing this package into an isolated DSH web profile')
command(process.execPath, [runtimeBin, 'plugin', '--profile', 'web', 'add', `file:${root}`])
const profilePath = join(env.DSH_HOME, 'profiles', 'web', 'cordis.patch.yml')
await writeFile(profilePath, stringify([
  { id: 'agent-default-model', config: { provider: 'release-deepseek', model: 'deepseek-chat' } },
  { id: 'llm-pi-ai', config: { providers: { 'release-deepseek': {
    displayName: 'DeepSeek release validation', api: 'openai-completions', baseURL: 'https://api.deepseek.com',
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 65536, maxTokens: 4096 }],
  } } } },
  { id: 'ui-effort-slider', config: { defaultDialect: 'deepseek', debugReport: true } },
  { insert: [{ id: 'release-live-logging', name: pathToFileURL(join(root, 'test', 'runtime-logging', 'index.mjs')).href }] },
]), 'utf8')

const server = spawn(process.execPath, [runtimeBin, '--profile', 'web', '--no-open', '--host', '127.0.0.1', '--port', '0'],
  { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
const serverLog = []
server.stderr.on('data', (chunk) => {
  serverLog.push(chunk.toString())
  if (process.env.DSH_LIVE_DEBUG === '1') process.stderr.write(chunk)
})
let browser
let page
const pageErrors = []
const profile = async () => parse(await readFile(profilePath, 'utf8'))
async function waitProfile(predicate, message) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const value = await profile()
    if (predicate(value)) return value
    await delay(100)
  }
  throw new Error(message)
}
const piAiOf = (value) => value.find((entry) => entry.id === 'llm-pi-ai').config.providers['release-deepseek']
const defaultOf = (value) => value.find((entry) => entry.id === 'agent-default-model').config

try {
  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH startup timed out: ${serverLog.join('')}`)), 120000)
    const lines = createInterface({ input: server.stdout })
    server.once('error', (error) => { clearTimeout(timer); reject(error) })
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`DSH exited ${code}: ${serverLog.join('')}`)) })
    lines.on('line', (line) => {
      if (!line.startsWith('dsh web: ')) return
      const parsed = new URL(line.slice('dsh web: '.length))
      assert.equal(parsed.hostname, '127.0.0.1')
      clearTimeout(timer)
      resolveUrl(parsed.href)
    })
  })
  const supplied = await waitProfile((value) => piAiOf(value).models[0].reasoningEfforts?.max === 'max', 'Host provisioning did not persist')
  assert.equal(piAiOf(supplied).models[0].compat.thinkingFormat, 'deepseek')
  console.log('ok: real SettingsForms provisioning persists the model effort dictionary and dialect')

  browser = await chromium.launch({ headless: true, env, channel: process.platform === 'win32' ? 'msedge' : undefined })
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('dialog').getByRole('button', { name: /^(继续|Continue)$/ }).click({ timeout: 60000 })
  const modelTrigger = page.getByRole('button', { name: /(?:选择模型，当前|Select model, current) DeepSeek Chat/ })
  await modelTrigger.click({ timeout: 60000 })
  await page.getByRole('menuitem', { name: /^(推理等级|Effort)/ }).click()
  const panel = page.locator('[data-effort-panel="true"]')
  await panel.waitFor({ state: 'visible' })
  const slider = panel.locator('input[type="range"]')
  const readySlider = panel.locator('input[type="range"]:enabled')
  await readySlider.waitFor({ state: 'visible' })
  assert.equal(await slider.isEnabled(), true)
  await slider.press('End')
  await waitProfile((value) => defaultOf(value).reasoningEffort === 'max', 'Real session.selectModel did not persist max')
  assert.equal(await panel.isVisible(), true, 'native input focus must keep the official menu open')
  assert.equal(defaultOf(await profile()).model, 'deepseek-chat')
  assert.equal(defaultOf(await profile()).provider, 'release-deepseek')
  await readySlider.waitFor({ state: 'visible' })
  assert.equal(Number(await slider.inputValue()), 100, 'directory refresh restores the selected max level')
  const colors = await modelTrigger.evaluate((trigger) => [...trigger.children]
    .filter((child) => child.tagName === 'SPAN').map((child) => child.style.color))
  assert.equal(colors[0], '', 'model label keeps its own styling')
  assert.notEqual(colors[1], '', 'effort caption is colored')
  await panel.getByRole('button', { name: /排查帮助|Troubleshooting/ }).click()
  assert.equal(await panel.getByRole('tooltip').isVisible(), true)
  await panel.getByRole('button', { name: /排查帮助|Troubleshooting/ }).click()
  // Moving focus from the slider commits its value once more. Wait for that
  // real directory refresh before recording the completed panel state.
  await readySlider.waitFor({ state: 'visible' })
  await panel.getByText('Ultracode', { exact: true }).waitFor({ state: 'visible' })
  await page.screenshot({ path: join(runRoot, 'desktop.png') })
  console.log('ok: real DSH UI loads the scoped plugin and keyboard selection persists without changing the model')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await modelTrigger.click({ timeout: 60000 })
  await page.getByRole('menuitem', { name: /^(推理等级|Effort)/ }).click()
  await panel.waitFor({ state: 'visible' })
  await readySlider.waitFor({ state: 'visible' })
  assert.equal(Number(await slider.inputValue()), 100, 'reloading the real app retains max')
  await page.setViewportSize({ width: 390, height: 844 })
  await slider.press('Home')
  await waitProfile((value) => defaultOf(value).reasoningEffort === 'off', 'Real session.selectModel did not persist off')
  await readySlider.waitFor({ state: 'visible' })
  assert.equal(Number(await slider.inputValue()), 0, 'directory refresh restores the selected off level')
  const bounds = await panel.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'panel stays inside a narrow viewport')
  await page.screenshot({ path: join(runRoot, 'mobile.png') })
  await slider.press('Escape')
  await panel.waitFor({ state: 'detached' })
  console.log('ok: selection survives reload; narrow viewport and Escape work in the real app')

  const changed = await profile()
  changed.find((entry) => entry.id === 'ui-effort-slider').config.defaultDialect = 'qwen'
  await writeFile(profilePath, stringify(changed), 'utf8')
  await waitProfile((value) => piAiOf(value).models[0].compat.thinkingFormat === 'qwen', 'Live dialect update did not reach the provider')
  assert.deepEqual(pageErrors, [], 'real app has no uncaught browser errors')
  await writeFile(join(workRoot, 'latest.json'), JSON.stringify({
    dsh: runtimeManifest.version, package: packageManifest.version, runDirectory: runRoot,
    hostProvisioning: true, scopedClientBoot: true, keyboardSelection: true, persistedSelection: true,
    modelPreserved: true, narrowViewport: true, liveDialectUpdate: true, browserErrors: pageErrors,
    scope: 'Configuration, model directory and Session selection; no model generation request was sent.',
  }, null, 2), 'utf8')
  console.log('ALL LIVE DSH 0.2.1-rc.2 PROFILE CHECKS PASSED')
} catch (error) {
  if (page !== undefined && !page.isClosed()) await page.screenshot({ path: join(runRoot, 'failure.png') })
  console.error(serverLog.join('').slice(-12000))
  throw error
} finally {
  await browser?.close()
  if (server.exitCode === null) {
    const stopped = new Promise((resolveStopped) => server.once('exit', resolveStopped))
    server.kill('SIGTERM')
    await Promise.race([stopped, delay(5000)])
    if (server.exitCode === null) server.kill('SIGKILL')
  }
  await writeFile(join(runRoot, 'server.log'), serverLog.join(''), 'utf8')
}
