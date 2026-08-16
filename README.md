# dsh-effort-slider

> 仿 Claude Code 推理等级滑块 —— DSH 独立插件。
> 点击模型菜单（官方 root 菜单第二行）的 **「推理等级」**，不再展开官方档位列表，
> 而是弹出 **Effort 滑块面板**：无极拖动、松手吸附、WebGL 火焰跟随、OFF/MAX 刻度、
> Low/Medium/High/Ultracode 状态实时显示。

> **原作者 / Attribution**
>
> 本插件剥离自 [CAPTAIN1275/dsh-ui-web](https://github.com/CAPTAIN1275/dsh-ui-web)（原作者），
> 具体位于其 `@captain1275/dsh-web-ui-all` v0.2.4 聚合插件内置的 aurora 皮肤
> （`@captain1275/dsh-client-ui-skin-aurora` v0.2.4）。
> 上游仓库根为 Apache-2.0（© 2026 zhu1090093659 (linxin), CAPTAIN1275），
> aurora 皮肤为 BSD-3-Clause（© 2026 dsh-web-ui-custom contributors）。
> 本插件与上游项目无隶属关系，完整声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 通用思考强度（v0.2.0 新功能）

**任何自定义的第三方模型/提供商都支持思考强度调节，且产生线上实际作用**：

- **适配器元数据供给（宿主）**：对未声明 `reasoning` 元数据的模型自动注入通用 5 档刻度
  （`off/low/medium/high/max` → OFF/Low/Medium/High/Ultracode），使官方模型菜单与本面板的选择器可用、请求校验通过；
- **线级供给（宿主，pi-ai）**：自动为 `llm-pi-ai` 设置里缺少 `reasoningEfforts` 的自定义模型
  补写 `reasoningEfforts` 字典与 `compat` 线方言（**热生效，无需重启**），由 pi-ai 按方言把档位
  翻译成真实的线上字段（`reasoning_effort` / `thinking` / OpenRouter `reasoning.effort` 等）；
- **客户端兜底刻度**：目录未返回 reasoning 元数据时，面板仍以通用 5 档刻度打开；
- 用户已有的声明（`reasoningEfforts: false` 或自定义字典）一律尊重、不会被覆盖。

支持的自定义端点线方言（设置 `effort-slider.defaultDialect` 或 `routes.<路由>`）：

| 方言 | 线上效果 |
| --- | --- |
| `effort`（默认） | OpenAI 风格 `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}` 开关 + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }`（OpenRouter 归一） |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + 可选 effort |
| `qwen` | `enable_thinking` 开关 |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort` 字符串 |

配置（写入 `~/.dsh/settings.yaml` 即热生效）：

```yaml
effort-slider:
  enabled: true          # 供给总开关
  defaultDialect: effort # 全局默认线方言
  routes:
    my-gateway: deepseek # 按路由覆盖
```

## 功能

- **无极拖动**：0–100 连续拖动，实时写入 `reasoningEffort`（16ms 节流，拖动中不堆积请求）
- **松手吸附**：松开/失焦/键盘结束时吸附到最近档位，并补发一次确认写入
- **WebGL 火焰跟随**：三通道着色器（点火 → 模糊 → 合成），火焰前沿以弹簧阻尼跟随滑块
- **OFF/MAX 刻度**：首尾档位固定显示 `OFF` / `MAX`，中间档位显示 API 返回名
- **Low/Medium/High/Ultracode 状态**：档位名实时显示在面板头部，随档位切换字体色/辉光
- **菜单行着色（v0.2.1）**：面板关闭后，模型菜单「推理等级」行上的档位值沿用同一套档位色（OFF 粉灰 / Low 橙金 / Medium 蓝 / High 紫 / Ultracode 亮紫辉光），官方重渲染也会自动重新涂色

只写 `reasoningEffort`，不动模型选择；无多档推理等级的模型显示「当前模型不提供多档推理等级」。

## 安装

```sh
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main
```

安装后重启 DeepSeek Harness，并在 Web 页面按一次 `Ctrl+F5`。
在模型菜单点击「推理等级」即弹出 Effort 滑块面板；
DevTools Console 出现 `[effort-slider] intercept row: ...` 表示拦截成功。

> 若同时安装了 `@captain1275/dsh-web-ui-all` 或 aurora 皮肤，二者都会拦截「推理等级」行，
> 需把其 `lib/client.js` 中 `text.startsWith("推理等级") || text.startsWith("Effort")`
> 改为 `false`（或在源码中删除 Effort 拦截段），避免双面板。

## 构建与测试

```sh
pnpm install
pnpm build   # tsdown → lib/index.js（宿主半区：通用思考强度供给）+ lib/client.js（浏览器半区）
pnpm test    # 宿主单测（方言/补丁幂等）+ jsdom 冒烟（拦截/渲染/吸附/兜底刻度/回收）
```

浏览器半区遵循官方外部插件约定：经典脚本 + `window.__ModuleLoader__.load` 工厂；
`react` / `react-dom/client` / `react/jsx-runtime` 走平台 externals；
`effort.module.css` 由 lightningcss 哈希类名并内联，在工厂执行时注入 `<style data-plugin>`。

## 结构

```text
src/
  index.ts                  宿主半区：通用思考强度供给（适配器元数据包装 + pi-ai 线级供给 + 设置段）
  effort-core.ts             纯逻辑：方言 → 线级映射、供给补丁生成（单测覆盖）
  client/
    index.ts                浏览器半区：拦截模型菜单「推理等级」行 + 面板锚点挂载
    css-modules.d.ts
    effort/
      EffortPanel.tsx       Effort 面板（档位/刻度/滑块/辉光）
      useWebglFire.ts       WebGL2 三通道火焰循环（弹簧跟随 + 空闲休眠）
      shaders.ts            顶点/点火/模糊/合成着色器
      effort.module.css     面板样式（lightningcss 内联注入）
cordis.patch.yml           bundle 补丁（insert ui-effort-slider 行）
lib/                       构建产物（client.js 附带 sourcemap）
test/                      host.spec.mjs 宿主单测 + client.smoke.mjs 冒烟测试
```

## 许可证

BSD-3-Clause，见 [LICENSE](./LICENSE)。剥离自 Apache-2.0 的 dsh-ui-web 仓库及其 BSD-3-Clause 的
aurora 皮肤，完整上游声明与许可证原文见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。