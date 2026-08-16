/**
 * 档位 → 颜色映射 —— 面板关闭后，模型菜单「推理等级」行的档位值沿用
 * 面板 status 同一套颜色（与 effort.module.css 的 .level0..4 色值一致）：
 * off → 粉灰、low → 橙金、medium → 蓝、high → 紫（辉光）、max → 亮紫（辉光）。
 * 第三方目录声明的常见高阶档位别名（ultra/xhigh…）映射到 max 色。
 */
export interface EffortColor {
  color: string
  /** 可选文字辉光（高阶档位）。 */
  glow?: string
}

const EFFORT_COLORS: Record<string, EffortColor> = {
  off: { color: '#c882a0' },
  low: { color: '#c8aa82' },
  medium: { color: '#82aac8' },
  high: { color: '#c084fc', glow: '0 0 10px #a855f7b3' },
  max: { color: '#d8b4fe', glow: '0 0 12px #a855f7' },
}

/** 常见第三方档位别名 → 高阶色。 */
const ALIASES: Record<string, string> = {
  ultra: 'max',
  xhigh: 'max',
  maximum: 'max',
}

/** 未知档位：高亮紫（表示档位由本插件控制）。 */
const UNKNOWN: EffortColor = { color: '#c084fc' }

/** 解析档位颜色：id（或别名）→ 色值；未知档位返回高亮紫。 */
export const effortColorFor = (effortId: string): EffortColor =>
  EFFORT_COLORS[ALIASES[effortId] ?? effortId] ?? UNKNOWN
