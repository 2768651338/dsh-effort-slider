/**
 * dsh-effort-slider 客户端冒烟测试：
 * 在 jsdom 中执行 lib/client.js 工厂，模拟点击模型菜单「推理等级」行，
 * 验证 Effort 面板挂载、目录加载、OFF/MAX 刻度、档位状态、
 * 拖动节流写入 + 松手吸附，以及关闭/卸载回收。
 * 运行：node test/client.smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'

let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}

const dom = new JSDOM('<!doctype html><html><body><div id="menu"><button role="menuitem">推理等级 · High</button></div></body></html>', {
  pretendToBeVisual: true,
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.HTMLInputElement = window.HTMLInputElement
globalThis.MouseEvent = window.MouseEvent
globalThis.Event = window.Event
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16)
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id)

// ---- 捕获 __ModuleLoader__ 注册 ----
let registered = null
window.__ModuleLoader__ = { load: (handoff) => { registered = handoff } }

// ---- 执行构建产物（脚本阶段只注册工厂） ----
const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
new Function('window', code)(window)
assert(registered !== null && registered.id === 'dsh-effort-slider', 'factory registered as dsh-effort-slider')

// ---- 材质化工厂 ----
const requireStub = (spec) => {
  if (spec === 'react') return React
  if (spec === 'react-dom/client') return ReactDOMClient
  if (spec === 'react/jsx-runtime') return jsxRuntime
  throw new Error('unexpected require: ' + spec)
}
const exportsObj = registered.factory(requireStub)
assert(JSON.stringify(exportsObj.inject) === JSON.stringify(['connection', 'sessions']), 'inject = [connection, sessions]')
assert(typeof exportsObj.apply === 'function', 'apply is a function')
assert(document.querySelector('style[data-plugin="dsh-effort-slider"]') !== null, 'CSS injected via <style data-plugin>')

// ---- 伪 ctx（4 档目录，当前 ultra） ----
const api = {
  sessions: {
    models: async () => ({
      result: {
        ok: true,
        value: {
          current: { provider: 'p1', model: 'm1', reasoningEffort: 'ultra' },
          groups: [{
            id: 'p1',
            models: [{
              id: 'm1',
              reasoning: {
                efforts: [
                  { id: 'low', name: 'Low' },
                  { id: 'medium', name: 'Medium' },
                  { id: 'high', name: 'High' },
                  { id: 'ultra', name: 'Ultracode' },
                ],
                defaultEffort: 'low',
              },
            }],
          }],
        },
      },
    }),
    selectModel: async () => ({ result: { ok: true } }),
  },
}
const sessions = { list: { getSnapshot: () => ({ current: 'sess-1' }) } }
let disposer = null
const ctx = {
  get: (name) => (name === 'sessions' ? sessions : name === 'connection' ? { api } : undefined),
  effect: (fn) => { disposer = fn() },
}

exportsObj.apply(ctx)
const host = document.querySelector('[data-effort-slider-host]')
assert(host !== null, 'host anchor div attached')
const row = document.querySelector('#menu button')

// ---- 点击「推理等级」行 ----
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))

const panel = host.querySelector('[data-effort-panel="true"]')
assert(panel !== null, 'panel rendered after intercept click')
if (panel !== null) {
  assert((panel.textContent ?? '').includes('Effort'), 'panel shows Effort label')
  assert((panel.textContent ?? '').includes('Ultracode'), 'status shows current effort Ultracode')
  assert((panel.textContent ?? '').includes('OFF'), 'scale shows OFF label')
  assert((panel.textContent ?? '').includes('MAX'), 'scale shows MAX label')
  assert((panel.textContent ?? '').includes('Medium') && (panel.textContent ?? '').includes('High'), 'middle level names visible')
  const range = panel.querySelector('input[type="range"]')
  assert(range !== null && range.min === '0' && range.max === '100' && range.step === '1' && range.disabled === false, 'slider enabled 0..100 step 1')
  assert(panel.querySelector('canvas') !== null, 'fire canvas mounted')

  // ---- 无极拖动 + 松手吸附 ----
  if (range !== null) {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    valueSetter.call(range, '52')
    range.dispatchEvent(new window.Event('input', { bubbles: true }))
    range.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    const statusText = panel.querySelector('span')?.textContent ?? ''
    assert((panel.textContent ?? '').includes('High') && !(panel.textContent ?? '').includes('Ultracode'), 'released at 52% snaps to nearest level (High, not Ultra)')
  }
}

// ---- 关闭按钮 ----
const closeBtn = host.querySelector('button[aria-label="关闭"]')
assert(closeBtn !== null, 'close button with aria-label 关闭')
closeBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel unmounted after close')

// ---- 面板外点击收起 ----
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
assert(host.querySelector('[data-effort-panel="true"]') !== null, 'panel reopens on second click')
document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel hides on outside click')

// ---- 通用兜底：模型未声明 reasoning 元数据时仍可用 5 档刻度 ----
disposer?.()
const apiNoReasoning = {
  sessions: {
    models: async () => ({
      result: {
        ok: true,
        value: {
          current: { provider: 'p2', model: 'custom-x' },
          groups: [{ id: 'p2', models: [{ id: 'custom-x' }] }],
        },
      },
    }),
    selectModel: async () => ({ result: { ok: true } }),
  },
}
let disposer2 = null
const ctx2 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'connection' ? { api: apiNoReasoning } : undefined),
  effect: (fn) => { disposer2 = fn() },
}
exportsObj.apply(ctx2)
const host2 = document.querySelector('[data-effort-slider-host]')
assert(host2 !== null, 'second apply attaches a fresh host')
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const panel2 = host2.querySelector('[data-effort-panel="true"]')
assert(panel2 !== null, 'panel opens for a model without reasoning metadata (universal fallback)')
if (panel2 !== null) {
  const text2 = panel2.textContent ?? ''
  assert(text2.includes('OFF') && text2.includes('MAX') && text2.includes('Low') && text2.includes('Medium') && text2.includes('High'), 'universal scale OFF/Low/Medium/High/MAX rendered')
  assert(!text2.includes('不支持思考强度调节'), 'no unavailable overlay for universal fallback')
  const range2 = panel2.querySelector('input[type="range"]')
  assert(range2 !== null && range2.disabled === false, 'slider enabled without declared efforts')
}
disposer2?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'second host removed by disposer')

console.log(failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)