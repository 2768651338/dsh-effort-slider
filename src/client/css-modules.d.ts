/** CSS Modules 类型声明（构建时由 tsdown 的 lightningcss 插件内联并产出类名映射）。 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
