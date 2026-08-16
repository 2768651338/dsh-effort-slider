/**
 * dsh-effort-slider 浏览器半区 —— 仿 Claude Code 推理等级滑块。
 * 点击官方模型菜单里的「推理等级」行时，拦截官方档位列表，
 * 改为弹出 Effort 滑块面板（只写 reasoningEffort，不动模型选择）。
 * 所有写入由 ctx.effect 的 disposer 在卸载时回收。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { EffortPanel } from './effort/EffortPanel.tsx'
import { effortColorFor, effortColorFromLabel } from './effort/effortColors.ts'

/** 档位颜色解析（客户端产物导出，供测试/复用）。 */
export { effortColorFor }

/** 需要的客户端服务：connection（模型目录读写）、sessions（当前会话）。 */
export const inject: string[] = ['connection', 'sessions']

/** 面板尺寸（与 effort.module.css 的 .panel 宽度一致）。 */
const PANEL_W = 280
const PANEL_H = 150

/**
 * 最近一次面板设置的档位（面板关闭后仍用于给菜单行着色）。
 * 用对象属性而非模块级 let：某些 bundler 会把「let x = null」+「if (x !== null)」
 * 误判为恒假分支并整体删除；对象属性写入无法静态折叠，不会被误删。
 */
const uiState: { lastEffortId: string | null } = { lastEffortId: null }

/** 官方菜单行的 label 文本（中/英两套语言包）。 */
const EFFORT_LABEL_TEXTS = new Set(['推理等级', 'Effort'])

/**
 * 官方菜单行的档位值 span：行内除了 label 与 chevron svg 外，
 * 剩下的文本 span 就是当前档位值（label 的相邻 span 优先）。
 */
function effortValueSpan(row: HTMLElement): HTMLElement | null {
  const spans = Array.from(row.querySelectorAll('span'))
  const labelIndex = spans.findIndex((span) => EFFORT_LABEL_TEXTS.has((span.textContent ?? '').trim()))
  if (labelIndex >= 0) {
    // 官方结构 label span 紧邻 value span。
    const next = spans[labelIndex + 1]
    if (next !== undefined && !EFFORT_LABEL_TEXTS.has((next.textContent ?? '').trim())) return next
  }
  for (const span of spans) {
    const text = (span.textContent ?? '').trim()
    if (text.length > 0 && !EFFORT_LABEL_TEXTS.has(text)) return span
  }
  return null
}

/** 给菜单行档位值着色（inline style，官方样式不会覆盖）。 */
function paintEffortRow(row: HTMLElement, effortId: string): void {
  const value = effortValueSpan(row)
  if (value === null) return
  const tone = effortColorFor(effortId)
  value.style.color = tone.color
  value.style.textShadow = tone.glow ?? 'none'
  console.log('[effort-slider] paint:', JSON.stringify((value.textContent ?? '').trim()), '→', tone.color, row.isConnected ? '' : '(detached)')
}

/**
 * 全量扫描文档里的「推理等级」菜单行并涂色。
 * 不依赖任何单节点引用或 mutation 粒度：官方重开菜单（整树原子挂载）、
 * 复用节点改文本、字符数据原地更新，都会在下一次扫描时被覆盖。
 */
function paintAllEffortRows(): void {
  for (const row of Array.from(document.querySelectorAll('button[role="menuitem"]'))) {
    const text = (row.textContent ?? '').trim()
    if (!(text.startsWith('推理等级') || text.startsWith('Effort'))) continue
    const value = effortValueSpan(row)
    // 优先用面板上报的档位；没有时从档位文本反推颜色。
    if (uiState.lastEffortId !== null) paintEffortRow(row, uiState.lastEffortId)
    else if (value !== null) {
      const inferred = effortColorFromLabel((value.textContent ?? '').trim())
      if (inferred !== null) {
        value.style.color = inferred.color
        value.style.textShadow = inferred.glow ?? 'none'
      }
    }
  }
  paintTriggerEffort()
}

/**
 * 模型菜单的入口触发按钮（输入框上方的模型座位，aria-haspopup="menu"）：
 * 官方在第一个 span 显示模型名、第二个 span 显示当前档位名。
 * 这里给档位名涂上与菜单行一致的颜色（菜单关闭后触发按钮常驻可见）。
 */
function paintTriggerEffort(): void {
  for (const trigger of Array.from(document.querySelectorAll('button[aria-haspopup="menu"]'))) {
    const aria = trigger.getAttribute('aria-label') ?? ''
    // 只有显示档位的触发器才带「推理等级 / reasoning effort」的可访问标签。
    if (!(aria.includes('推理等级') || aria.includes('reasoning effort'))) continue
    const spans = Array.from(trigger.querySelectorAll('span'))
    const value = spans[1]
    if (value === undefined) continue
    if (uiState.lastEffortId !== null) {
      const tone = effortColorFor(uiState.lastEffortId)
      value.style.color = tone.color
      value.style.textShadow = tone.glow ?? 'none'
      continue
    }
    const inferred = effortColorFromLabel((value.textContent ?? '').trim())
    if (inferred !== null) {
      value.style.color = inferred.color
      value.style.textShadow = inferred.glow ?? 'none'
    }
  }
}

/** rAF 节流：observer 高频触发时合并为一次扫描。 */
let paintQueued = false
const schedulePaintAll = (): void => {
  if (paintQueued) return
  paintQueued = true
  const run = (): void => {
    paintQueued = false
    paintAllEffortRows()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 16)
}

/**
 * 应用 Effort 滑块：挂载固定锚点容器 + 捕获阶段拦截模型菜单「推理等级」行。
 * @param ctx - 宿主上下文（effect 生命周期负责回收）。
 */
export function apply(ctx: ClientContext): void {
  const body = document.body

  // 固定挂载点：0x0 锚点 div 挂在 body 下，面板按触发行位置绝对定位。
  const host = document.createElement('div')
  host.dataset.effortSliderHost = ''
  host.style.cssText = 'position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;'
  body.appendChild(host)
  let root: Root | null = null

  const hidePanel = (): void => {
    root?.unmount()
    root = null
    // 面板关闭后补涂一次：操作期间官方可能已重渲染菜单行。
    schedulePaintAll()
  }

  const showPanel = (sessionId: string, anchor: HTMLElement): void => {
    const rect = anchor.getBoundingClientRect()
    // 面板 280 宽、约 150 高；视口内定位，下方不够时弹到锚点上方。
    const left = Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8))
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= PANEL_H + 16
      ? rect.bottom + 8
      : Math.max(8, rect.top - PANEL_H - 8)
    host.style.left = `${left}px`
    host.style.top = `${top}px`
    if (root === null) root = createRoot(host)
    root.render(createElement(EffortPanel, {
      sessionId,
      connection: ctx.get('connection') as ConnectionHandle,
      onClose: hidePanel,
      onEffortChange,
    }))
  }

  /** 面板档位变化：记住当前档位，并给仍开着的菜单行即时涂色。 */
  const onEffortChange = (effortId: string): void => {
    uiState.lastEffortId = effortId
    paintAllEffortRows()
  }

  // 官方菜单每次打开都会重新挂载行、档位文本变化会替换文本节点；
  // MutationObserver 守护这些重渲染，保证颜色在面板关闭后依然生效。
  // 官方菜单每次打开都会重新挂载（常常整树原子提交）、档位文本变化会替换或
  // 原地更新文本节点；任何 DOM 变化都触发一次节流全量扫描，保证颜色在面板
  // 关闭后依然生效，且不依赖 mutation 的具体粒度。
  const paintObserver = typeof MutationObserver === 'undefined'
    ? null
    : new MutationObserver(() => schedulePaintAll())
  if (paintObserver !== null) {
    paintObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  const onDocClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    // 面板内部交互不处理。
    if (host.contains(target)) return
    const row = target.closest?.('button[role="menuitem"]')
    if (row instanceof HTMLElement) {
      const text = (row.textContent ?? '').trim()
      // 官方 root 菜单的第二行：label「推理等级」/「Effort」。
      if (text.startsWith('推理等级') || text.startsWith('Effort')) {
        console.log('[effort-slider] intercept row:', JSON.stringify(text))
        event.preventDefault()
        event.stopPropagation()
        paintAllEffortRows()
        const current = (ctx.get('sessions') as { list: { getSnapshot(): { current?: string } } }).list.getSnapshot().current
        console.log('[effort-slider] session:', current)
        if (current !== undefined) showPanel(current, row)
        else console.warn('[effort-slider] no session id')
        return
      }
    }
    if (!host.contains(target)) hidePanel()
  }
  document.addEventListener('click', onDocClick, true)

  ctx.effect(
    () => () => {
      document.removeEventListener('click', onDocClick, true)
      paintObserver?.disconnect()
      uiState.lastEffortId = null
      hidePanel()
      host.remove()
    },
    'ui-effort-slider: effort panel',
  )
}
