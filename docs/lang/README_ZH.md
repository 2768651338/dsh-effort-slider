<!-- 中文版。English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · **中文** · [Español](README_ES.md) · [日本語](README_JA.md) · [Deutsch](README_DE.md) · [Русский](README_RU.md) · [Português](README_PT.md) · [한국어](README_KO.md)

</div>

> ※ 本文档为英文版的翻译；如有出入以[英文版](../../README.md)为准。欢迎通过 Issue / PR 修正翻译。

<div align="center">

# dsh-effort-slider

> **仿 Claude Code 推理等级滑块** —— 点击模型菜单「推理等级」，无极拖动、松手吸附、WebGL 火焰跟随；任何第三方模型/提供商的思考强度都真实生效。

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

点击模型菜单（官方 root 菜单第二行）的 **「推理等级」**，不再展开官方档位列表，
而是弹出 **Effort 滑块面板**：OFF/MAX 刻度、Low/Medium/High/Ultracode 状态实时显示，
面板关闭后菜单行的档位值保留对应档位色。

[功能](#功能) · [兼容性](#兼容性) · [安装 / 卸载](#安装--卸载) · [快速开始](#快速开始) · [配置](#配置) · [权限与数据](#权限与数据) · [工作原理](#工作原理) · [常见问题](#常见问题) · [开发](#开发)<br>

**演示截图**（模型菜单「推理等级」行 / 模型座位入口按钮 / Effort 滑块面板，档位随等级着色）：

| 菜单行着色 | 模型座位按钮 | Effort 面板 |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="模型菜单「推理等级」行着色" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="模型座位入口按钮着色" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Effort 滑块面板" width="240"> |



</div>

---

> 🆕 **v0.4.0** — 适配 DSH **0.2.0**：DSH 用 `SettingsForms` 取代了原有 settings 服务（设置现以 profile entry 配置形式存在；`installSection` / `settings.get` / `settings/updated` 均已移除）。宿主半区现定位 pi-ai profile entry（`llm-pi-ai`），经 `settings.describe()` 读取、经 `settings.mutate()` 写入，并监听 `settings/document-updated`。客户端半区改由 `retainedBy.mainView` 推导当前会话（`SessionListState.current` 已移除）。插件选项（`enabled` / `defaultDialect` / `routes`）存于插件的 entry 配置，可在 DSH 设置页编辑。不再支持 DSH ≤ 0.1.5（该版本请使用 v0.3.0）。
>
> 🆕 **v0.3.0** — 适配 DSH 0.1.5：客户端 `Context` 改取自 `@deepseek-ai/cordis`，会话状态经 `ctx.modelDirectories` 读写，设置段经 `settings.installSection()` 安装；删除已不可行的适配器元数据包装（见下方「通用思考强度」一节）。不再支持 DSH ≤ 0.1.1。
>
> 🔧 **v0.2.5** — 修复通用供给在显式 `models` 数组上静默失败（dsh-settings 的 path 补丁不能穿过数组节点，现改为整数组替换）。
>
> 🔧 **v0.2.4** — 修复 pi-ai 设置段晚注册时通用供给永不落地（现改为就绪重试）。
>
> 🆕 **v0.2.3** — 模型座位入口按钮的档位名也按档位着色，菜单关闭后常驻可见。
>
> 🔧 **v0.2.2** — 修复菜单整树重挂载时菜单行着色失效（全量节流重涂；档位色可由档位文本反推）。
>
> 🆕 **v0.2.1** — 面板关闭后，模型菜单「推理等级」行上的档位值保留档位色。
>
> ✨ **v0.2.0** — 任何自定义第三方模型/提供商的思考强度调节真实生效（热生效）。
>
> 🎛️ **v0.1.0** — 初始版本：拦截官方「推理等级」菜单，弹出仿 Claude Code 的 Effort 滑块面板。
>
> 各版本完整说明见 [Releases](https://github.com/2768651338/dsh-effort-slider/releases)。

---

## 功能

| 功能 | 说明 |
| --- | --- |
| 🎚️ 无极拖动 | 0–100 连续拖动，实时写入 `reasoningEffort`（16ms 节流，拖动中不堆积请求） |
| 🎯 松手吸附 | 松开/失焦/键盘结束时吸附到最近档位，并补发一次确认写入 |
| 🔥 WebGL 火焰跟随 | 三通道着色器（点火 → 模糊 → 合成），火焰前沿以弹簧阻尼跟随滑块 |
| 🏁 OFF/MAX 刻度 | 首尾档位固定显示 `OFF` / `MAX`，中间档位显示 API 返回名 |
| 🎨 档位状态 | 档位名实时显示在面板头部并随档位切换颜色/辉光；关闭面板后菜单行与模型座位入口按钮（「模型 · 档位」）同色保持（v0.2.3） |
| 🌐 通用思考强度 | 未声明 `reasoning` 元数据的第三方模型自动获得通用 5 档刻度；pi-ai 模型自动补写线级字典，**热生效**（v0.2.0） |

只写 `reasoningEffort`，不动模型选择；无多档推理等级的模型显示「当前模型不提供多档推理等级」。

### 通用思考强度（v0.2.0，v0.3.0 简化）

**任何自定义的第三方模型/提供商都支持思考强度调节，且产生线上实际作用**：

- **线级供给（宿主，pi-ai）**：自动为 `llm-pi-ai` 设置里缺少 `reasoningEfforts` 的自定义模型
  补写 `reasoningEfforts` 字典与 `compat` 线方言（**热生效，无需重启**），由 pi-ai 按方言把档位
  翻译成真实的线上字段（`reasoning_effort` / `thinking` / OpenRouter `reasoning.effort` 等），
  **同时把同一份声明作为该模型的 `reasoning` 目录元数据暴露出去** —— 手工声明的模型能出现官方
  「推理等级」行，靠的就是这一点；
- **客户端兜底刻度**：目录未返回 reasoning 元数据时，面板仍以通用 5 档刻度打开；
- 用户已有的声明（`reasoningEfforts: false` 或自定义字典）一律尊重、不会被覆盖。

> **为什么不再有适配器包装。** v0.2.5 及以前，宿主半区还会包装各适配器的 `resolveModel`，为未声明
> `reasoning` 元数据的模型注入 `universalReasoning`。DSH 0.1.5 把 `llm.adapters` 变成了没有公开
> 访问器的私有字段，这条路已不可行 —— 也不再必要：`reasoningEfforts` 是唯一同时喂给「请求线路」和
> 「模型目录」的声明。模型级 `compat` 只在路由声明了 `api: openai-completions` 时写入，因为 pi-ai
> 会拒绝「该模型协议读不到的开关」。

支持的自定义端点线方言（设置 `effort-slider.defaultDialect` 或 `routes.<路由>`）：

| 方言 | 线上效果 |
| --- | --- |
| `effort`（默认） | OpenAI 风格 `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}` 开关 + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }`（OpenRouter 归一） |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + 可选 effort |
| `qwen` | `enable_thinking` 开关 |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort` 字符串 |

## 兼容性

| 项目 | 值 |
| --- | --- |
| DSH 版本 | **0.2.0-rc.2**（npm `latest` dist-tag，本构建即针对该版本验证）；web profile，Windows |
| 不再支持 | DSH ≤ 0.1.5 —— v0.4.0 面向 0.2.0 引入的 `SettingsForms` settings 服务（DSH 0.1.5 请使用 v0.3.0；v0.2.5 及更早还导入了 `@deepseek-ai/dsh-client-runtime`，该包在 0.1.1-rc.2 之后已被移除） |
| 安装机制 | `dsh plugin --profile web add`（bundle patch + 双半区） |
| 依赖 | `ctx.sessions`（`@deepseek-ai/dsh-api-session-controller`）与 `ctx.modelDirectories`（`@deepseek-ai/dsh-client-ui-model-selection`）；宿主：`ctx.llm`、`ctx.settings`（`SettingsForms`） |
| 客户端模块请求 | 除平台基座（`react` / `react-dom/client` / `react/jsx-runtime`）外无任何请求 —— 所有 DSH import 都是纯类型、打包时被擦除 |

## 安装 / 卸载

```sh
# GitHub 安装（lib/ 构建产物已提交，无需本地构建）
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# 或本地构建后从检出目录安装
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> 安装后**重启 DeepSeek Harness**，并在 Web 页面按一次 **Ctrl+F5**。
> `lib/` 构建产物已提交，GitHub 安装无需本地构建。

**从「固定在旧 DSH 上的版本」升级过来？** 请删掉 `~/.dsh/profiles/web/cordis.patch.yml` 里的
`- id: ui-effort-slider` / `disabled: true` 行，否则新构建仍处于关闭状态。

| 操作 | 命令 |
| --- | --- |
| 升级 | `dsh plugin --profile web update dsh-effort-slider`（或重跑 add），然后重启 DSH |
| 卸载 | `dsh plugin --profile web remove dsh-effort-slider`，并从 `cordis.patch.yml` 移除其行（如有） |

## 快速开始

1. 安装插件并重启 DSH，页面按 `Ctrl+F5`。
2. 点击输入框上方的模型菜单（root 菜单第二行）→ 点 **「推理等级」** → 弹出 Effort 滑块面板。
3. 拖动滑块选择档位，松手自动吸附；面板关闭后模型菜单上的档位值保持对应颜色。
4. 自定义模型无思考强度时，面板自动以通用 5 档打开；pi-ai 模型在宿主侧自动补写线级字典（热生效）。

DevTools Console 出现 `[effort-slider] intercept row: ...` 表示拦截成功。

## 配置

| 项目 | 详情 |
| --- | --- |
| 插件级选项 | 插件的 profile entry 配置（`enabled` / `defaultDialect` / `routes`），可在 DSH 设置页（自动生成的表单）编辑，插件重挂载时生效 |
| 默认值 | `enabled: true`，`defaultDialect: effort` |
| 环境变量 | 无自有变量，遵循 DSH 的 `DSH_HOME` 解析 |
| 敏感项 | 无 — 不读取、不存储任何密钥/令牌/凭据 |

```yaml
effort-slider:
  enabled: true          # 供给总开关
  defaultDialect: effort # 全局默认线方言
  routes:
    my-gateway: deepseek # 按路由覆盖
```

## 权限与数据

| 范围 | 内容 |
| --- | --- |
| 文件（读） | 无 — 不读写任何用户文件（设置经 DSH settings 服务） |
| 网络 | 无自有网络请求 — 面板读写浏览器内的 Model Controller 共享目录，最终 `session.selectModel` 调用复用 DSH 既有连接 |
| 凭据 | 永不读取 |
| 用户数据 | 不读取（不接触会话内容/消息/提示词；仅经共享模型目录读写当前会话的 provider/model/`reasoningEffort`） |

## 工作原理

| 半区 | 文件 | 职责 |
| --- | --- | --- |
| 宿主 | `lib/index.js` | 通用思考强度供给：定位 pi-ai profile entry（`llm-pi-ai`），经 `settings.describe()` 读取，经 `settings.mutate` 补写线方言（`buildProvisionOps`，幂等、尊重用户声明）；监听 `llm/adapters-updated` / `settings/document-updated` |
| 浏览器 | `lib/client.js` | 捕获阶段拦截模型菜单「推理等级」行 → 弹出 Effort 面板；经 `ctx.modelDirectories.directoryFor(sessionId)` 读目录、经 `directory.select({ reasoningEffort })` 写入；面板关闭后经 MutationObserver 守护菜单行档位色 |

> 浏览器半区遵循官方外部插件约定：经典脚本 + `window.__ModuleLoader__.load` 工厂；
> `react` / `react-dom/client` / `react/jsx-runtime` 走平台 externals；
> `effort.module.css` 由 lightningcss 哈希类名并内联，在工厂执行时注入 `<style data-plugin>`。

## 常见问题

| 现象 | 解决 |
| --- | --- |
| 模型菜单没有「推理等级」行 | 该模型未声明 reasoning 元数据且宿主供给未生效 — 确认重启过 DSH，并在插件的设置页（其 profile entry 配置）检查 `enabled` |
| 面板显示「当前模型不支持思考强度调节」 | 通用兜底未启用 — 升级到 v0.2.0+ 并重启 |
| 插件根本没加载（行被标了 `disabled: true`） | 旧构建曾在 `~/.dsh/profiles/web/cordis.patch.yml` 里被关掉；删掉该行再重启 |
| 拖动后档位不生效 | 检查目标端点的线方言是否匹配（见上方方言表），或为该路由显式设置 `defaultDialect` |
| 与其它皮肤插件冲突 | 若同时安装了会拦截「推理等级」行的皮肤（如 dsh-ui-web 系列的 aurora），需将其拦截段禁用，避免双面板 |
| 重启后版本仍显示旧版 | `file:` 安装是快照拷贝 — 用 `github:` 安装或重跑 add 后再重启 |
| 日志在哪 | 宿主错误看 DSH 启动日志；客户端错误看浏览器 DevTools（F12）Console（`[effort-slider]` 前缀） |

## 结构

```text
src/
  index.ts                  宿主半区：经 SettingsForms 接缝的 pi-ai 线级供给
  effort-core.ts             纯逻辑：方言 → 线级映射、供给补丁生成（单测覆盖）
  client/
    index.ts                浏览器半区：拦截模型菜单「推理等级」行 + 面板锚点挂载 + 菜单行着色
    css-modules.d.ts
    effort/
      directory.ts          ctx.modelDirectories / ctx.sessions 的结构面（纯类型，不 import DSH 运行时）
      EffortPanel.tsx       Effort 面板（档位/刻度/滑块/辉光）
      useWebglFire.ts       WebGL2 三通道火焰循环（弹簧跟随 + 空闲休眠）
      shaders.ts            顶点/点火/模糊/合成着色器
      effortColors.ts       档位 → 颜色映射（面板与菜单行共用）
      effort.module.css     面板样式（lightningcss 内联注入）
cordis.patch.yml           bundle 补丁（insert ui-effort-slider 行）
lib/                       构建产物（client.js 附带 sourcemap）
test/                      host.spec.mjs 宿主单测 + host-apply.spec.mjs + client.smoke.mjs 冒烟测试
```

## 开发

```sh
pnpm install
pnpm build       # tsdown → lib/index.js（宿主半区）+ lib/client.js（浏览器半区）
pnpm typecheck   # tsc --noEmit（对 @deepseek-ai/* 0.2.0-rc.2 全绿）
pnpm test        # 宿主单测 + apply 集成 + 真实接缝集成 + jsdom 冒烟
```

`test/` 四层，由浅入深：

| 文件 | 覆盖范围 |
| --- | --- |
| `host.spec.mjs` | 纯逻辑：方言 → 线级映射、供给补丁生成、幂等 |
| `host-apply.spec.mjs` | mock cordis 上下文下的 `apply()`：pi-ai entry 晚注册的重试、`compat` 按协议声明门控、`settings/document-updated` 幂等 |
| `host-integration.spec.mjs` | **真实接缝**：真 `@deepseek-ai/cordis` + 忠实的 `SettingsForms` 接缝替身（0.2.0 的 npm 包没有独立提供方）—— entry 发现、真实 path-op 落盘进 profile entry 配置、写出的 `reasoningEfforts`/`compat` 通过 pi-ai 校验规则 |
| `client.smoke.mjs` | jsdom：产物工厂材质化、拦截「推理等级」行、面板渲染、拖动/吸附经 `directory.select` 写入、着色、卸载回收 |

**贡献.** Fork → 修改 → `pnpm build` → 跑 `pnpm test` → 向 `main` 开 PR。小修复（文档、测试）无需事先讨论；报告问题时附 DSH 版本与具体报错。

## 许可证与安全

**许可证**：BSD-3-Clause — 见 [LICENSE](../../LICENSE)。
界面实现参考了社区 dsh-ui-web 项目的 aurora 皮肤（BSD-3-Clause），完整上游声明与许可证原文见
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。

**安全**：本插件不读取任何凭据、不发送任何网络数据（仅与本机 DSH 通信）。安全问题的私下报告请使用
GitHub Security tab 的 **Report a vulnerability**，勿公开张贴利用细节。

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
