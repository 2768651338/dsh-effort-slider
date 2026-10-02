/**
 * dsh-effort-slider 浏览器半区 —— 仿 Claude Code 推理等级滑块。
 * 点击官方模型菜单里的「推理等级」行时，拦截官方档位列表，
 * 改为弹出 Effort 滑块面板（只写 reasoningEffort，不动模型选择）。
 * 所有写入由 ctx.effect 的 disposer 在卸载时回收。
 *
 * 数据与写入走 `ctx.modelDirectories`（每会话共享目录）而不是直连 RPC：
 * 0.1.5 起 ConnectionHandle 不再暴露 `.api`，官方两个模型入口（/model 弹层与
 * 输入框上方的模型座位）也都改从这份共享目录读写，本插件跟随同一份状态，
 * 因此面板里的改动与官方入口永远一致。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { EffortPanel } from './effort/EffortPanel.tsx'
import { effortColorFor, effortColorFromLabel, effortIdFromLabel, canonicalEffortId } from './effort/effortColors.ts'
import { currentSessionId, type ModelDirectoriesLike, type SessionsLike } from './effort/directory.ts'
import { PANEL_W, PANEL_H } from './effort/metrics.ts'

/** 档位颜色解析（客户端产物导出，供测试/复用）。 */
export { effortColorFor }

/** 需要的客户端服务：sessions（当前会话）与 modelDirectories（每会话共享模型目录）。 */
export const inject: string[] = ['sessions', 'modelDirectories']

/**
 * 最近一次面板设置的档位（面板关闭后仍用于给菜单行着色）。
 * 用对象属性而非模块级 let：某些 bundler 会把「let x = null」+「if (x !== null)」
 * 误判为恒假分支并整体删除；对象属性写入无法静态折叠，不会被误删。
 */
const uiState: { lastEffortId: string | null } = { lastEffortId: null }

/** 任意一次扫描命中过 Effort 入口（菜单行或触发按钮）。 */
let effortUiDetected = false
/** 「从未识别到入口却发生菜单行点击」的一次性诊断 warn 只发一次。 */
let unrecognizedMenuWarned = false

/**
 * 官方 Effort 入口识别文案（中/英两套语言包）。DSH 新增界面语言或官方改措辞时
 * 在这两张表里追加即可；识别失败不再静默——见 onDocClick 的一次性诊断 warn。
 */
const EFFORT_LABELS = ['推理等级', 'Effort'] as const
const EFFORT_LABEL_TEXTS = new Set<string>(EFFORT_LABELS)
/** 触发按钮（模型座位）aria-label 里的 Effort 片段（includes 匹配）。 */
const EFFORT_TRIGGER_ARIA = ['推理等级', 'reasoning effort'] as const

/** 菜单行按前缀匹配（label 在行文本开头）。 */
const matchesEffortRowText = (text: string): boolean =>
  EFFORT_LABELS.some((label) => text.startsWith(label))
/** 触发按钮 aria-label 按片段匹配。 */
const matchesEffortTriggerAria = (aria: string): boolean =>
  EFFORT_TRIGGER_ARIA.some((fragment) => aria.includes(fragment))

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
}

/**
 * 面板上报的 lastEffortId 与行内档位文本是否仍然一致。面板用过的档位可能已被
 * 用户从官方入口（/model 弹层）改掉——行内文本才是用户眼前的现实，颜色必须
 * 跟着文本走，否则「行上写着 Low、颜色还停在 High 的紫」两个信号打架。
 */
function lastEffortMatchesText(valueText: string): boolean {
  const last = uiState.lastEffortId
  if (last === null || valueText.length === 0) return false
  const textId = effortIdFromLabel(valueText)
  if (textId !== null) return textId === canonicalEffortId(last)
  // 自定义档位名不在别名表里：id 与显示名宽松比对（id 通常是显示名的小写形式）。
  return last.toLowerCase() === valueText.trim().toLowerCase()
}

/**
 * 全量扫描文档里的「推理等级」菜单行并涂色。
 * 不依赖任何单节点引用或 mutation 粒度：官方重开菜单（整树原子挂载）、
 * 复用节点改文本、字符数据原地更新，都会在下一次扫描时被覆盖。
 * 着色依据：行内文本与 lastEffortId 一致时按 lastEffortId；不一致回退文本反推；
 * 文本也认不出（自定义命名）时清除 inline 色、回退官方原色——宁可失去着色，
 * 也不沿用可能过期的颜色。
 */
function paintAllEffortRows(): void {
  for (const row of Array.from(document.querySelectorAll<HTMLElement>('button[role="menuitem"]'))) {
    const text = (row.textContent ?? '').trim()
    if (!matchesEffortRowText(text)) continue
    effortUiDetected = true
    const value = effortValueSpan(row)
    const valueText = (value?.textContent ?? '').trim()
    if (uiState.lastEffortId !== null && lastEffortMatchesText(valueText)) {
      paintEffortRow(row, uiState.lastEffortId)
    } else if (value !== null) {
      const inferred = effortColorFromLabel(valueText)
      if (inferred !== null) {
        value.style.color = inferred.color
        value.style.textShadow = inferred.glow ?? 'none'
      } else {
        value.style.color = ''
        value.style.textShadow = ''
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
  for (const trigger of Array.from(document.querySelectorAll<HTMLElement>('button[aria-haspopup="menu"]'))) {
    const aria = trigger.getAttribute('aria-label') ?? ''
    // 只有显示档位的触发器才带「推理等级 / reasoning effort」的可访问标签。
    if (!matchesEffortTriggerAria(aria)) continue
    effortUiDetected = true
    const spans = Array.from(trigger.querySelectorAll('span'))
    const value = spans[1]
    if (value === undefined) continue
    const valueText = (value.textContent ?? '').trim()
    // 与菜单行同一套着色依据：文本校验优先，过期档位回退文本反推，再失败回退官方原色。
    if (uiState.lastEffortId !== null && lastEffortMatchesText(valueText)) {
      const tone = effortColorFor(uiState.lastEffortId)
      value.style.color = tone.color
      value.style.textShadow = tone.glow ?? 'none'
      continue
    }
    const inferred = effortColorFromLabel(valueText)
    if (inferred !== null) {
      value.style.color = inferred.color
      value.style.textShadow = inferred.glow ?? 'none'
    } else {
      value.style.color = ''
      value.style.textShadow = ''
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
  // 每次装配重置识别诊断状态（cordis 配置变更会 dispose 后重新 apply）。
  effortUiDetected = false
  unrecognizedMenuWarned = false

  const sessions = ctx.get('sessions') as SessionsLike | undefined
  const directories = ctx.get('modelDirectories') as ModelDirectoriesLike | undefined
  if (sessions === undefined || directories === undefined) {
    console.warn('[effort-slider] sessions/modelDirectories service unavailable — panel disabled')
    return
  }

  // 固定挂载点：0x0 锚点 div 挂在 body 下，面板按触发行位置绝对定位。
  const host = document.createElement('div')
  host.dataset.effortSliderHost = ''
  host.style.cssText = 'position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;'
  body.appendChild(host)
  let root: Root | null = null
  // 当前面板的锚点行（跟随定位与「再次点击收起」的判定用）。
  let anchorRef: HTMLElement | null = null

  const hidePanel = (): void => {
    anchorRef = null
    root?.unmount()
    root = null
    // 面板关闭后补涂一次：操作期间官方可能已重渲染菜单行。
    schedulePaintAll()
  }

  /** 按锚点矩形把面板摆进视口（下方不够时弹到锚点上方）。 */
  const placePanelAt = (rect: DOMRect): void => {
    const left = Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8))
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= PANEL_H + 16
      ? rect.bottom + 8
      : Math.max(8, rect.top - PANEL_H - 8)
    host.style.left = `${left}px`
    host.style.top = `${top}px`
  }

  /**
   * scroll/resize 时的跟随重定位。锚点已卸载（官方菜单关闭即卸载行）或被隐藏
   * （getBoundingClientRect 全 0，如 display:none）时「重算」没有意义，
   * 唯一正确行为是直接关面板——这个检查也是跟随逻辑天然要求实现的部分。
   */
  const repositionPanel = (): void => {
    const anchor = anchorRef
    if (anchor === null || root === null) return
    if (!anchor.isConnected) {
      hidePanel()
      return
    }
    const rect = anchor.getBoundingClientRect()
    if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) {
      hidePanel()
      return
    }
    placePanelAt(rect)
  }

  const showPanel = (sessionId: string, anchor: HTMLElement): void => {
    anchorRef = anchor
    placePanelAt(anchor.getBoundingClientRect())
    if (root === null) root = createRoot(host)
    root.render(createElement(EffortPanel, {
      sessionId,
      directory: directories.directoryFor(sessionId),
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
  // 任何 DOM 变化都触发一次节流全量扫描，不依赖 mutation 的具体粒度。
  const paintObserver = typeof MutationObserver === 'undefined'
    ? null
    : new MutationObserver(() => schedulePaintAll())
  if (paintObserver !== null) {
    paintObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  const onDocClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null
    // 面板内部交互不处理。
    if (target !== null && host.contains(target)) return
    const row = target?.closest?.('button[role="menuitem"]')
    if (row instanceof HTMLElement) {
      const text = (row.textContent ?? '').trim()
      // 官方 root 菜单的第二行：label「推理等级」/「Effort」。
      if (matchesEffortRowText(text)) {
        event.preventDefault()
        event.stopPropagation()
        // 面板开着时再点同一行 = 收起（toggle），而不是原地重渲染同位置。
        if (root !== null && anchorRef === row) {
          hidePanel()
          return
        }
        paintAllEffortRows()
        const current = currentSessionId(sessions)
        if (current !== undefined) showPanel(current, row)
        else console.warn('[effort-slider] no session id')
        return
      }
      // 识别诊断：点的是菜单行，但此前任何一次扫描都没识别到 Effort 入口
      // （触发按钮常驻，正常界面在首次扫描就会命中）——官方措辞或界面语言
      // 很可能已不在已知文案表内，整条拦截链正在静默失效。发一次性 warn
      // 留下排障线索，而不是让插件无声消失。
      if (!effortUiDetected && !unrecognizedMenuWarned) {
        unrecognizedMenuWarned = true
        console.warn('[effort-slider] a menu item was clicked but the effort row/trigger has never been recognized — official wording or UI language may have changed and interception/coloring are inactive (known labels: 推理等级 / Effort)')
      }
    }
    hidePanel()
  }
  document.addEventListener('click', onDocClick, true)

  // Esc 关闭面板（不阻断传播：官方菜单的 Esc 关闭行为照常）。
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && root !== null) hidePanel()
  }
  document.addEventListener('keydown', onKeyDown, true)
  // 面板打开期间跟随滚动/窗口变化（capture：scroll 不冒泡，只有捕获能拿到）。
  window.addEventListener('scroll', repositionPanel, true)
  window.addEventListener('resize', repositionPanel)

  ctx.effect(
    () => () => {
      document.removeEventListener('click', onDocClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', repositionPanel, true)
      window.removeEventListener('resize', repositionPanel)
      paintObserver?.disconnect()
      uiState.lastEffortId = null
      hidePanel()
      host.remove()
    },
    'ui-effort-slider: effort panel',
  )
}
