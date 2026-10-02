/**
 * 面板/滑块的共享尺寸常量 —— 面板宽度与 thumb 尺寸在 JS（外层定位、刻度布点、
 * 点光源）和 CSS（.panel 宽、thumb 大小）两边都要用，这里收敛为单一来源：
 * JS 侧通过内联自定义属性（--effort-panel-w / --effort-thumb-w）喂给 CSS，
 * 避免「改 A 忘 B」的多处手工同步。
 */

/** 面板宽度（CSS .panel 的 width，也是外层视口定位换算的基准）。 */
export const PANEL_W = 280
/** 面板约高（外层判断上下空间用，允许略偏）。 */
export const PANEL_H = 150
/** 滑块 thumb 宽度（webkit/moz 两引擎统一为同一尺寸，刻度对齐公式依赖它）。 */
export const THUMB_W = 28
