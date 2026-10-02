/**
 * dsh-effort-slider 客户端冒烟测试（适配 DSH 0.2.0 的 modelDirectories 共享目录
 * 与会话目录新形状：0.2.0 起 SessionListState 移除 current 字段，当前会话
 * 由 retainedBy.mainView > 0 判定）：在 jsdom 中执行 lib/client.js 工厂，
 * 模拟点击模型菜单「推理等级」行，验证 Effort 面板挂载、目录加载、OFF/MAX
 * 刻度、档位状态、拖动节流写入 + 松手吸附，以及关闭/卸载回收。
 * 另覆盖评估报告的异常路径：状态三分支 overlay（P0-1）、写入失败反馈（P1-1）、
 * 未知文案诊断 warn（P1-2①）、着色文本校验（P2-3）、面板跟随/Esc/toggle（P2-2）、
 * 双语文案（P2-4）、刻度对齐公式（P2-5）、aria 标注（P2-6）、双写路径钉测（P2-8）、
 * 不支持提示旁的排查引导（P3-1）、「?」排查提示开合与双语路由点名（P3-2）。
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
// P2-4：面板文案按 <html lang> 取语言；锁定中文以匹配下面的中文断言（en 场景单独测）。
document.documentElement.lang = 'zh-CN'
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

// 0.2.0 会话目录形状：无 current 字段，当前会话 = retainedBy.mainView > 0 的行。
const sessions = { list: { getSnapshot: () => ({ ids: ['sess-1'], byId: { 'sess-1': { id: 'sess-1', retainedBy: { mainView: 1 } } }, phase: 'ready' }) } }
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
  // P2-6：读屏可命名 + 档位名播报（而非裸数字）。
  assert(range !== null && range.getAttribute('aria-label') === '思考强度', 'slider has an accessible name (P2-6)')
  assert(range?.getAttribute('aria-valuetext') === 'Ultracode', 'aria-valuetext reports the current effort name (P2-6)')
  // P2-5：刻度点/标签按 thumb 行程布点（起点 = 半 thumb 14px，行程 = 100% - 28px）。
  const calcTicks = Array.from(panel.querySelectorAll('span')).filter((s) => (s.getAttribute('style') ?? '').includes('calc(14px'))
  assert(calcTicks.length === 8, 'tick dots + labels positioned via thumb-travel calc (P2-5)')
  // jsdom 的 CSSOM 会把 0.0000 归一化为 0，这里兼容两种序列化形式。
  assert(/left: calc\(14px \+ 0(\.0+)? \* \(100% - 28px\)\)/.test(calcTicks[0]?.getAttribute('style') ?? ''), 'first tick sits at half-thumb inset (P2-5)')
  assert(rowSpans.length === 2 && valueSpanRef.current !== undefined && (valueSpanRef.current.textContent ?? '').trim() === 'High', 'menu row has label+value spans')
  // P2-3：目录报 ultra 但官方行文本还是 High——行内文本是用户眼前的现实，
  // 颜色跟随文本（high 色），而不是沿用面板上报的 ultra（max 色）。
  assert(valueSpanRef.current?.style.color === 'rgb(192, 132, 252)', 'menu row painted from row text when panel report mismatches (P2-3)')
  assert(valueSpanRef.current?.style.textShadow === '0 0 10px #a855f7b3', 'text-inferred high glow applied to menu row')
  assert(triggerEffort?.style.color === 'rgb(192, 132, 252)', 'trigger painted from its text when panel report mismatches (P2-3)')
  assert(triggerEffort?.style.textShadow === '0 0 10px #a855f7b3', 'text-inferred high glow applied to trigger')

  // ---- P3-2：「?」排查提示——拖动无效时的路径引导（点名当前路由，双语）----
  const helpBtn = panel.querySelector('button[aria-label="排查帮助"]')
  assert(helpBtn !== null, 'help button present in the panel header (P3-2)')
  helpBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 30))
  const hintText = panel.querySelector('[role="tooltip"]')?.textContent ?? ''
  assert(hintText.includes('routes.p1') && hintText.includes('方言'), 'help hint names the current route and the dialect config (P3-2)')
  assert(hintText.includes('debugReport'), 'help hint points at the debugReport trace (P3-2)')
  assert(helpBtn?.getAttribute('aria-expanded') === 'true', 'help button reports expanded state (P3-2)')
  helpBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert(panel.querySelector('[role="tooltip"]') === null && helpBtn?.getAttribute('aria-expanded') === 'false', 'help hint toggles closed again (P3-2)')

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
    assert(range?.getAttribute('aria-valuetext') === 'High', 'aria-valuetext follows the snapped level after drag (P2-6)')
  }
}

// ---- 关闭按钮 ----
const closeBtn = host.querySelector('button[aria-label="关闭"]')
assert(closeBtn !== null, 'close button with aria-label 关闭')
closeBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel unmounted after close')

// ---- 面板关闭后：官方重渲染替换档位文本，observer 重涂时颜色必须跟随新文本（P2-3）----
if (typeof window.MutationObserver !== 'undefined' && valueSpanRef.current !== undefined) {
  valueSpanRef.current.textContent = 'Ultracode'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(valueSpanRef.current.style.color === 'rgb(216, 180, 254)', 'observer repaint follows official text change (Ultracode → max color, not stale high)')
  assert(valueSpanRef.current.style.textShadow === '0 0 12px #a855f7', 'max glow applied after official text change')
  assert(valueSpanRef.current.textContent === 'Ultracode', 'observer does not clobber official text')
}

// ---- 面板关闭后：官方菜单整体重挂载（新子树一次挂载），observer 必须按新行文本涂色 ----
if (typeof window.MutationObserver !== 'undefined') {
  // 移除整个旧菜单容器，挂载一棵全新菜单子树（模拟官方 React 原子提交重开菜单）
  const menu = document.querySelector('#menu')
  const fresh = document.createElement('div')
  fresh.id = 'menu'
  fresh.innerHTML = '<button role="menuitem"><span>推理等级</span><span>Ultracode</span></button>'
  menu.replaceWith(fresh)
  await new Promise((resolve) => setTimeout(resolve, 80))
  const freshValue = fresh.querySelectorAll('span')[1]
  assert(freshValue?.style.color === 'rgb(216, 180, 254)', 'observer paints newly mounted subtree by its text (Ultracode → max)')
  triggerEffort.textContent = 'Ultracode'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(triggerEffort.style.color === 'rgb(216, 180, 254)', 'trigger follows official text change too (Ultracode → max)')
  // 后续场景改用重挂载后的新行（旧引用已 detached）
  row = fresh.querySelector('button')
  valueSpanRef.current = freshValue
}

// ---- P2-3 补充：文本反推成功/失败的两个分支 ----
if (typeof window.MutationObserver !== 'undefined' && valueSpanRef.current !== undefined) {
  valueSpanRef.current.textContent = 'Low'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(valueSpanRef.current.style.color === 'rgb(200, 170, 130)', 'text-inferred low color when official text changes to Low (P2-3)')
  assert(valueSpanRef.current.style.textShadow === 'none', 'low tone has no glow on the text-inferred path')
  valueSpanRef.current.textContent = 'Turbo'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(valueSpanRef.current.style.color === '' && valueSpanRef.current.style.textShadow === '', 'unrecognizable custom name clears inline color back to official (P2-3)')
  // 场景收尾：恢复「High」文本与 lastEffortId 一致（后续用例依赖该形状）。
  valueSpanRef.current.textContent = 'High'
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(valueSpanRef.current.style.color === 'rgb(192, 132, 252)', 'restored matching text repaints with lastEffortId again (P2-3)')
}

// ---- 面板外点击收起 + 再次点击 Effort 行 toggle + Esc 关闭（P2-2） ----
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
assert(host.querySelector('[data-effort-panel="true"]') !== null, 'panel reopens on click')
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 60))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'clicking the effort row again toggles the panel closed (P2-2)')
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
assert(host.querySelector('[data-effort-panel="true"]') !== null, 'panel reopens after toggle close')
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 60))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'Escape closes the panel (P2-2)')
document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 30))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel hides on outside click')

// ---- P2-2：锚点行被官方卸载后再滚动 → 面板跟随关闭，而不是悬在原地 ----
const tmpRow = document.createElement('button')
tmpRow.setAttribute('role', 'menuitem')
tmpRow.innerHTML = '<span>推理等级</span><span>High</span>'
document.body.appendChild(tmpRow)
tmpRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
assert(host.querySelector('[data-effort-panel="true"]') !== null, 'panel opens from a throwaway anchor row')
tmpRow.remove()
window.dispatchEvent(new window.Event('scroll'))
await new Promise((resolve) => setTimeout(resolve, 60))
assert(host.querySelector('[data-effort-panel="true"]') === null, 'panel closes when its anchor unmounts and a scroll follows (P2-2)')

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

// ---- P0-1：目录 status: 'error' 时必须显示「加载失败 + 重试」，而不是「不支持」 ----
let errorLoadCalls = 0
let errorState = { current: null, groups: [], status: 'error', error: 'host directory failed' }
const errorListeners = new Set()
const errorDirectory = {
  store: {
    getSnapshot: () => errorState,
    subscribe: (fn) => { errorListeners.add(fn); return () => errorListeners.delete(fn) },
  },
  load() {
    errorLoadCalls++
    // 面板打开自动触发的第一次 load() 不恢复（模拟宿主装配失败后仍停在 error），
    // 只有重试触发的第二次才让目录就绪。
    if (errorLoadCalls >= 2) {
      errorState = {
        current: { provider: 'p4', model: 'm4', reasoningEffort: 'high' },
        groups: [{ id: 'p4', models: [{ id: 'm4', reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'low' } }] }],
        status: 'ready',
      }
      for (const fn of Array.from(errorListeners)) fn()
    }
    return Promise.resolve(errorState)
  },
  async select() {},
}
let disposer4 = null
const ctx4 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => errorDirectory } : undefined),
  effect: (fn) => { disposer4 = fn() },
}
exportsObj.apply(ctx4)
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host4 = document.querySelector('[data-effort-slider-host]')
const panel4 = host4?.querySelector('[data-effort-panel="true"]')
assert(panel4 !== null, 'panel opens even when directory snapshot reports error')
if (panel4 !== null) {
  const text4 = panel4.textContent ?? ''
  assert(text4.includes('模型目录加载失败'), 'error overlay shown for status error directory')
  assert(!text4.includes('不支持思考强度调节'), 'unsupported message NOT shown for error directory')
  const retryBtn = Array.from(panel4.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === '重试')
  assert(retryBtn !== undefined, 'retry button rendered in error overlay')
  retryBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 120))
  assert(errorLoadCalls === 2, 'retry triggers a second directory.load()')
  const text4b = panel4.textContent ?? ''
  const range4 = panel4.querySelector('input[type="range"]')
  assert(!text4b.includes('模型目录加载失败') && range4 !== null && range4.disabled === false, 'panel recovers to usable after retry load succeeds')
}
disposer4?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'fourth host removed by disposer')

// ---- P0-1：load() 挂起时显示「加载中」；被拒后走错误分支；重试成功后恢复 ----
let flakyCalls = 0
let flakyResolve = null
let flakyReject = null
let flakyState = { current: null, groups: [], status: 'loading' }
const flakyListeners = new Set()
const flakyDirectory = {
  store: {
    getSnapshot: () => flakyState,
    subscribe: (fn) => { flakyListeners.add(fn); return () => flakyListeners.delete(fn) },
  },
  load() {
    flakyCalls++
    return new Promise((resolve, reject) => {
      flakyResolve = () => {
        flakyState = {
          current: { provider: 'p5', model: 'm5', reasoningEffort: 'low' },
          groups: [{ id: 'p5', models: [{ id: 'm5', reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }] }],
          status: 'ready',
        }
        for (const fn of Array.from(flakyListeners)) fn()
        resolve()
      }
      flakyReject = () => reject(new Error('network blip'))
    })
  },
  async select() {},
}
let disposer5 = null
const ctx5 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => flakyDirectory } : undefined),
  effect: (fn) => { disposer5 = fn() },
}
exportsObj.apply(ctx5)
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host5 = document.querySelector('[data-effort-slider-host]')
const panel5 = host5?.querySelector('[data-effort-panel="true"]')
assert(panel5 !== null, 'panel opens while directory load pending')
if (panel5 !== null) {
  const text5 = panel5.textContent ?? ''
  assert(text5.includes('模型目录加载中…') && !text5.includes('不支持思考强度调节'), 'loading overlay while directory load pending (not unsupported)')
  flakyReject?.()
  await new Promise((resolve) => setTimeout(resolve, 60))
  const text5b = panel5.textContent ?? ''
  assert(text5b.includes('模型目录加载失败') && !text5b.includes('不支持思考强度调节'), 'rejected load() falls back to error overlay')
  const retryBtn5 = Array.from(panel5.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === '重试')
  retryBtn5?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert(flakyCalls === 2, 'retry calls load() again after rejection')
  flakyResolve?.()
  await new Promise((resolve) => setTimeout(resolve, 120))
  const text5c = panel5.textContent ?? ''
  const range5 = panel5.querySelector('input[type="range"]')
  assert(!text5c.includes('模型目录加载失败') && range5 !== null && range5.disabled === false, 'panel recovers after retried load resolves')
}
disposer5?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'fifth host removed by disposer')

// ---- P1-1：select 被拒时 header 状态短暂显示「写入失败」，滑块不被回退 ----
const rejectDirectory = createDirectory({
  current: { provider: 'p6', model: 'm6', reasoningEffort: 'low' },
  groups: [{ id: 'p6', models: [{ id: 'm6', reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }], defaultEffort: 'low' } }] }],
  status: 'ready',
})
let rejectedSelectCalls = 0
rejectDirectory.select = async () => {
  rejectedSelectCalls++
  throw new Error('gateway rate limited')
}
let disposer6 = null
const ctx6 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => rejectDirectory } : undefined),
  effect: (fn) => { disposer6 = fn() },
}
exportsObj.apply(ctx6)
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host6 = document.querySelector('[data-effort-slider-host]')
const panel6 = host6?.querySelector('[data-effort-panel="true"]')
assert(panel6 !== null, 'panel opens on the write-failure directory')
if (panel6 !== null) {
  const range6 = panel6.querySelector('input[type="range"]')
  const valueSetter6 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  valueSetter6.call(range6, '52')
  range6.dispatchEvent(new window.Event('input', { bubbles: true }))
  range6.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(rejectedSelectCalls >= 2, 'drag and commit both attempted directory.select')
  // P2-8：pointerup + blur 连续触发是双写路径——把「blur 后再补一笔同值写入」钉住。
  const callsAfterPointerUp = rejectedSelectCalls
  range6.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert(rejectedSelectCalls === callsAfterPointerUp + 1, 'blur after pointerup commits once more (double-commit pinned, same value)')
  assert((panel6.textContent ?? '').includes('写入失败'), 'failed select surfaces a write-error state in the panel header')
  assert(Number(range6.value) > 40, 'slider position is not reset after a failed write')
  await new Promise((resolve) => setTimeout(resolve, 2300))
  assert(!(panel6.textContent ?? '').includes('写入失败'), 'write-error state clears itself after ~2s')
}
disposer6?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'sixth host removed by disposer')

// ---- P1-2：菜单行文案不可识别时——不拦截，但留下一次性诊断 warn ----
const warnings = []
const origWarn = console.warn
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); origWarn(...args) }
// 把官方入口换成「未知语言/措辞」：菜单行与触发按钮都不再命中已知文案。
const menuNow = document.querySelector('#menu')
menuNow.innerHTML = '<button role="menuitem"><span>推論レベル</span><span>High</span></button>'
document.querySelector('button[aria-haspopup="menu"]')?.setAttribute('aria-label', 'Select model, current m')
const foreignRow = menuNow.querySelector('button')
let disposer7 = null
const ctx7 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => rejectDirectory } : undefined),
  effect: (fn) => { disposer7 = fn() },
}
exportsObj.apply(ctx7)
foreignRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 80))
const host7 = document.querySelector('[data-effort-slider-host]')
assert(host7?.querySelector('[data-effort-panel="true"]') === null, 'unknown-language row is NOT intercepted (panel stays closed)')
assert(warnings.some((w) => w.includes('[effort-slider]') && w.includes('never been recognized')), 'one-time diagnostic warn explains the unrecognized effort row')
const warnCountAfterFirst = warnings.length
foreignRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 80))
assert(warnings.length === warnCountAfterFirst, 'diagnostic warn fires only once per apply')
console.warn = origWarn
disposer7?.()

// ---- P2-4：界面语言为英文时，面板文案与 aria 走英文文案表 ----
const enRow = document.createElement('button')
enRow.setAttribute('role', 'menuitem')
enRow.innerHTML = '<span>推理等级</span><span>High</span>'
document.querySelector('#menu').replaceChildren(enRow)
document.documentElement.lang = 'en'
let disposer8 = null
const ctx8 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => directory } : undefined),
  effect: (fn) => { disposer8 = fn() },
}
exportsObj.apply(ctx8)
enRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host8 = document.querySelector('[data-effort-slider-host]')
const panel8 = host8?.querySelector('[data-effort-panel="true"]')
assert(panel8 !== null, 'panel opens under en UI language')
if (panel8 !== null) {
  assert(panel8.querySelector('button[aria-label="Close"]') !== null, 'close button aria-label is English (P2-4)')
  const range8 = panel8.querySelector('input[type="range"]')
  assert(range8?.getAttribute('aria-label') === 'Reasoning effort', 'slider aria-label is English (P2-4/P2-6)')
  const text8 = panel8.textContent ?? ''
  assert(!text8.includes('关闭') && !text8.includes('不支持') && !text8.includes('加载'), 'no Chinese strings leak into the en panel')
  // P3-2：英文界面下的排查提示也走英文文案表（点名路由，无中文残留）。
  const helpBtn8 = panel8.querySelector('button[aria-label="Troubleshooting"]')
  helpBtn8?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 30))
  const hint8 = panel8.querySelector('[role="tooltip"]')?.textContent ?? ''
  assert(hint8.includes('routes.p1') && hint8.includes('dialect') && !/[\u4e00-\u9fff]/.test(hint8), 'en help hint names route + dialect config with no Chinese leak (P3-2)')
}
disposer8?.()
document.documentElement.lang = 'zh-CN'
assert(document.querySelector('[data-effort-slider-host]') === null, 'eighth host removed by disposer')

// ---- P3-1：目录就绪但模型确不支持（声明刻度不足 2 档）→「不支持」提示旁必须有排查引导 ----
const unsupportedDirectory = createDirectory({
  current: { provider: 'p9', model: 'm9', reasoningEffort: 'low' },
  groups: [{ id: 'p9', models: [{ id: 'm9', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }] }],
  status: 'ready',
})
let disposer9 = null
const ctx9 = {
  get: (name) => (name === 'sessions' ? sessions : name === 'modelDirectories' ? { directoryFor: () => unsupportedDirectory } : undefined),
  effect: (fn) => { disposer9 = fn() },
}
exportsObj.apply(ctx9)
enRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await new Promise((resolve) => setTimeout(resolve, 120))
const host9 = document.querySelector('[data-effort-slider-host]')
const panel9 = host9?.querySelector('[data-effort-panel="true"]')
assert(panel9 !== null, 'panel opens for a model declaring a single effort level')
if (panel9 !== null) {
  const text9 = panel9.textContent ?? ''
  assert(text9.includes('不支持思考强度调节'), 'unsupported overlay shown for a single-effort declared model')
  assert(text9.includes('enabled') && text9.includes('方言'), 'hint next to the unsupported message points at enabled & dialect config (P3-1)')
  assert(text9.includes('debugReport'), 'hint mentions debugReport for the host-side provisioning report (P3-1)')
}
disposer9?.()
assert(document.querySelector('[data-effort-slider-host]') === null, 'ninth host removed by disposer')

console.log(failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)
