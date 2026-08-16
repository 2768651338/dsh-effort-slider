/**
 * dsh-effort-slider 浏览器半区 —— 仿 Claude Code 推理等级滑块。
 * 从 @captain1275/dsh-web-ui-all v0.2.4 内置 aurora 皮肤中剥离：
 * 点击官方模型菜单里的「推理等级」行时，拦截官方档位列表，
 * 改为弹出 Effort 滑块面板（只写 reasoningEffort，不动模型选择）。
 * 所有写入由 ctx.effect 的 disposer 在卸载时回收。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { EffortPanel } from './effort/EffortPanel.tsx'

/** 需要的客户端服务：connection（模型目录读写）、sessions（当前会话）。 */
export const inject: string[] = ['connection', 'sessions']

/** 面板尺寸（与 effort.module.css 的 .panel 宽度一致）。 */
const PANEL_W = 280
const PANEL_H = 150

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
    }))
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
      hidePanel()
      host.remove()
    },
    'ui-effort-slider: effort panel',
  )
}
