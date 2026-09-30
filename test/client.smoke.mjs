/**
 * dsh-effort-slider 客户端冒烟测试（适配 0.1.5 的 modelDirectories 共享目录）：
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

const dom = new JSDOM('<!doctype html><html><body><div id="menu"><button role="menuitem"><span>推理等级</span><span>High</span></button></div><button aria-haspopup="menu" aria-label="选择模型，当前 m，推理等级 High"><span>m</span><span>High</span></button></body></html>', {
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
if (typeof window.MutationObserver !== 'undefined') globalThis.MutationObserver = window.MutationObserver
globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16)
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id)

// ---- 捕获 __ModuleLoader__ 注册 ----
let registered = null
window.__ModuleLoader__ = { load: (handoff) => { registered = handoff } }

// ---- 执行构建产物（脚本阶段只注册工厂） ----
const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
new Function('window', code)(window)
assert(registered !== null && registered.id === 'dsh-effort-slider', 'factory registered as dsh-effort-slider')

// ---- 材质化工厂（任何超出平台基座的 require 都会抛错：产物不得依赖 DSH 运行时模块）----
const requireStub = (spec) => {
  if (spec === 'react') return React
  if (spec === 'react-dom/client') return ReactDOMClient
  if (spec === 'react/jsx-runtime') return jsxRuntime
  throw new Error('unexpected require: ' + spec)
}
const exportsObj = registered.factory(requireStub)
assert(JSON.stringify(exportsObj.inject) === JSON.stringify(['sessions', 'modelDirectories']), 'inject = [sessions, modelDirectories]')
assert(typeof exportsObj.apply === 'function', 'apply is a function')
assert(document.querySelector('style[data-plugin="dsh-effort-slider"]') !== null, 'CSS injected via <style data-plugin>')

// ---- 伪 modelDirectories：一份可观察的每会话共享目录 ----
function createDirectory(initial) {
  let state = initial
  const listeners = new Set()
  const selections = []
  return {
    selections,
    store: {
      getSnapshot: () => state,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    },
    async load() { return state },
    /** 模拟官方 ModelDirectory.select：写入后宿主投影回流到同一份 store。 */
    async select(selection) {
      selections.push(selection)
      state = { ...state, current: { ...selection }, status: 'ready' }
      for (const fn of Array.from(listeners)) fn()
    },
    set(next) {
      state = next
      for (const fn of Array.from(listeners)) fn()
    },
  }
}

const directory = createDirectory({
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
  status: 'ready',
})

const sessions = { list: { getSnapshot: () => ({ current: 'sess-1' }) } }
let disposer = null
const ctx = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => directory } : undefined),
  effect: (fn) => { disposer = fn() },
}

exportsObj.apply(ctx)
const host = document.querySelector('[data-effort-slider-host]')
assert(host !== null, 'host anchor div attached')
let row = document.querySelector('#menu button')

// ---- 点击「推理等级」行 ----
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))

const panel = host.querySelector('[data-effort-panel="true"]')
assert(panel !== null, 'panel rendered after intercept click')
const rowSpans = row.querySelectorAll('span')
const valueSpanRef = { current: rowSpans[1] }
const trigger = document.querySelector('button[aria-haspopup="menu"]')
const triggerEffort = trigger?.querySelectorAll('span')[1]
if (panel !== null) {
  assert((panel.textContent ?? '').includes('Effort'), 'panel shows Effort label')
  assert((panel.textContent ?? '').includes('Ultracode'), 'status shows current effort Ultracode')
  assert((panel.textContent ?? '').includes('OFF'), 'scale shows OFF label')
  assert((panel.textContent ?? '').includes('MAX'), 'scale shows MAX label')
  assert((panel.textContent ?? '').includes('Medium') && (panel.textContent ?? '').includes('High'), 'middle level names visible')
  const range = panel.querySelector('input[type="range"]')
  assert(range !== null && range.min === '0' && range.max === '100' && range.step === '1' && range.disabled === false, 'slider enabled 0..100 step 1')
  assert(panel.querySelector('canvas') !== null, 'fire canvas mounted')
  assert(rowSpans.length === 2 && valueSpanRef.current !== undefined && (valueSpanRef.current.textContent ?? '').trim() === 'High', 'menu row has label+value spans')
  assert(valueSpanRef.current?.style.color === 'rgb(216, 180, 254)', 'menu row value painted for ultra (max alias color)')
  assert(valueSpanRef.current?.style.textShadow === '0 0 12px #a855f7', 'ultra glow applied to menu row')
  assert(triggerEffort?.style.color === 'rgb(216, 180, 254)', 'model-seat trigger effort painted for ultra')
  assert(triggerEffort?.style.textShadow === '0 0 12px #a855f7', 'ultra glow applied to trigger')

  // ---- 无极拖动 + 松手吸附 ----
  if (range !== null) {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    valueSetter.call(range, '52')
    range.dispatchEvent(new window.Event('input', { bubbles: true }))
    assert(directory.selections.length === 1 && directory.selections[0].reasoningEffort === 'high', 'drag writes the nearest level through directory.select (high)')
    assert(directory.selections[0].provider === 'p1' && directory.selections[0].model === 'm1', 'drag write keeps provider/model untouched')
    range.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    assert((panel.textContent ?? '').includes('High') && !(panel.textContent ?? '').includes('Ultracode'), 'released at 52% snaps to nearest level (High, not Ultra)')
    assert(valueSpanRef.current?.style.color === 'rgb(192, 132, 252)', 'menu row repainted for high after drag')
    assert(valueSpanRef.current?.style.textShadow === '0 0 10px #a855f7b3', 'high glow applied to menu row')
    assert(triggerEffort?.style.color === 'rgb(192, 132, 252)', 'trigger repainted for high after drag')
  }
}

// ---- 关闭按钮 ----
const closeBtn = host.querySelector('button[aria-label="关闭"]')
assert(closeBtn !== null, 'close button with aria-label 关闭')
closeBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel unmounted after close')

// ---- 面板关闭后：官方重渲染替换档位文本，observer 重新涂色 ----
if (typeof window.MutationObserver !== 'undefined' && valueSpanRef.current !== undefined) {
  valueSpanRef.current.textContent = 'Ultracode'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(valueSpanRef.current.style.color === 'rgb(192, 132, 252)', 'observer repaints menu row after text replace (keeps last high)')
  assert(valueSpanRef.current.textContent === 'Ultracode', 'observer does not clobber official text')
}

// ---- 面板关闭后：官方菜单整体重挂载（新子树一次挂载），observer 必须给新行涂色 ----
if (typeof window.MutationObserver !== 'undefined') {
  // 移除整个旧菜单容器，挂载一棵全新菜单子树（模拟官方 React 原子提交重开菜单）
  const menu = document.querySelector('#menu')
  const fresh = document.createElement('div')
  fresh.id = 'menu'
  fresh.innerHTML = '<button role="menuitem"><span>推理等级</span><span>Ultracode</span></button>'
  menu.replaceWith(fresh)
  await new Promise((resolve) => setTimeout(resolve, 80))
  const freshValue = fresh.querySelectorAll('span')[1]
  assert(freshValue?.style.color === 'rgb(192, 132, 252)', 'observer repaints newly mounted menu subtree (whole-menu remount)')
  triggerEffort.textContent = 'Ultracode'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(triggerEffort.style.color === 'rgb(192, 132, 252)', 'trigger keeps color after official text replace (last high)')
  // 后续场景改用重挂载后的新行（旧引用已 detached）
  row = fresh.querySelector('button')
  valueSpanRef.current = freshValue
}

// ---- 面板外点击收起 ----
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
assert(host.querySelector('[data-effort-panel="true"]') !== null, 'panel reopens on second click')
document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel hides on outside click')

// ---- 官方入口改档位时面板跟随（不是本面板写出去的变化必须同步） ----
disposer?.()
let disposer2 = null
const ctx2 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => directory } : undefined),
  effect: (fn) => { disposer2 = fn() },
}
exportsObj.apply(ctx2)
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host2 = document.querySelector('[data-effort-slider-host]')
const panel2 = host2.querySelector('[data-effort-panel="true"]')
assert(panel2 !== null, 'panel reopens under a fresh apply')
directory.set({
  ...directory.store.getSnapshot(),
  current: { provider: 'p1', model: 'm1', reasoningEffort: 'medium' },
})
await new Promise((resolve) => setTimeout(resolve, 60))
assert((panel2.textContent ?? '').includes('Medium'), 'panel follows an official-side effort change (medium)')
directory.set({
  ...directory.store.getSnapshot(),
  current: { provider: 'p1', model: 'm1', reasoningEffort: 'high' },
})
await new Promise((resolve) => setTimeout(resolve, 60))
assert((panel2.textContent ?? '').includes('High'), 'panel follows a second official-side change back to a previously written level (high)')
disposer2?.()

// ---- 通用兜底：模型未声明 reasoning 元数据时仍可用 5 档刻度 ----
const universalDirectory = createDirectory({
  current: { provider: 'p2', model: 'custom-x' },
  groups: [{ id: 'p2', models: [{ id: 'custom-x' }] }],
  status: 'ready',
})
let disposer3 = null
const ctx3 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => universalDirectory } : undefined),
  effect: (fn) => { disposer3 = fn() },
}
exportsObj.apply(ctx3)
const host3 = document.querySelector('[data-effort-slider-host]')
assert(host3 !== null, 'third apply attaches a fresh host')
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const panel3 = host3.querySelector('[data-effort-panel="true"]')
assert(panel3 !== null, 'panel opens for a model without reasoning metadata (universal fallback)')
if (panel3 !== null) {
  const text3 = panel3.textContent ?? ''
  assert(text3.includes('OFF') && text3.includes('MAX') && text3.includes('Low') && text3.includes('Medium') && text3.includes('High'), 'universal scale OFF/Low/Medium/High/MAX rendered')
  assert(!text3.includes('不支持思考强度调节'), 'no unavailable overlay for universal fallback')
  const range3 = panel3.querySelector('input[type="range"]')
  assert(range3 !== null && range3.disabled === false, 'slider enabled without declared efforts')
}
disposer3?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'third host removed by disposer')

console.log(failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)
