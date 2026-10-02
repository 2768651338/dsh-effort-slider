/**
 * dsh-effort-slider 构建配置：宿主 half（ESM lib/index.js，空操作）+
 * 浏览器 half（CJS lib/client.js）。
 * 浏览器 half 复用官方外部插件约定：经典脚本 + window.__ModuleLoader__.load 工厂；
 * 平台模块（react / react-dom / react-jsx-runtime）走 externals；
 * CSS Modules 由 lightningcss 内联并在工厂执行时注入 <style data-plugin>。
 */

import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const ID = 'dsh-effort-slider'

/** 浏览器 externals：shell 共享的冻结模块表（本插件仅依赖这三个平台种子）。 */
const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
]

/** CSS 虚拟模块前后缀：避开 tsdown 自身的 css 管线。 */
const CSS_VIRTUAL_PREFIX = '\0dsh-effort-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** 解析虚拟 CSS id 对应的物理文件。 */
function sourceAssetPath(source: string, importer: string | undefined): string {
  return resolvePath(dirname(importer ?? ''), source)
}

/** 宿主 half：ESM 库构建（纯浏览器插件，宿主侧为空操作）。 */
const libConfig: UserConfig = {
  name: ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: [/^@deepseek-ai\//],
  },
}

/** 浏览器 half：CJS 工厂包 + 平台 externals + 内联 CSS。 */
const clientConfig: UserConfig = {
  name: ID + '/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id) ? false : true),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [{
    name: 'dsh-effort-slider-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      // 键序必须排序：lightningcss 的 cssModules 导出顺序在构建间不稳定，
      // 不排序会让产物每次构建都不同，CI 的「产物新鲜度」检查恒红。
      for (const [local, exp] of Object.entries(cssExports ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        classMap[local] = exp.name
      }
      const cssBody = [
        'const css = ' + JSON.stringify(code.toString()) + ';',
        'const tagId = ' + JSON.stringify(ID + '/' + basename(fileId)) + ';',
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style');",
        '  tag.dataset.plugin = ' + JSON.stringify(ID) + ';',
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        'export default ' + JSON.stringify(classMap) + ';',
      ]
      return cssBody.join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [libConfig, clientConfig]