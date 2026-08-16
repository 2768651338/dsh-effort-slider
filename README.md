<!-- 中文 README：结构参考 dsh-plugin-manager（2768651338/dsh-plugin-manager） -->
<div align="center">

# dsh-effort-slider

> **仿 Claude Code 推理等级滑块** —— 点击模型菜单「推理等级」，无极拖动、松手吸附、WebGL 火焰跟随；任何第三方模型/提供商的思考强度都真实生效。

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.2.5-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

点击模型菜单（官方 root 菜单第二行）的 **「推理等级」**，不再展开官方档位列表，
而是弹出 **Effort 滑块面板**：OFF/MAX 刻度、Low/Medium/High/Ultracode 状态实时显示，
面板关闭后菜单行的档位值保留对应档位色。

[功能](#功能) · [兼容性](#兼容性) · [安装 / 卸载](#安装--卸载) · [快速开始](#快速开始) · [配置](#配置) · [权限与数据](#权限与数据) · [工作原理](#工作原理) · [常见问题](#常见问题) · [开发](#开发)

</div>

---

> 🔧 **v0.2.5** — 修复通用思考强度供给真正的落地 bug：显式 models 数组改为整数组替换（dsh-settings 的 path 补丁不能穿过数组中间节点，否则 models 被破坏、schema 拒绝、供给静默失败）。
>
> 🔧 **v0.2.4** — 修复通用思考强度供给在 pi-ai 设置段晚注册时永不落地：供给改为就绪重试（段注册晚于适配器且不触发 settings/updated），自定义模型现可稳定获得思考强度。
>
> 🆕 **v0.2.3** — 模型座位的入口按钮（输入框上方「模型 · 档位」）档位名也按档位着色，菜单关闭后常驻可见。
>
> 🔧 **v0.2.2** — 修复菜单行着色在官方菜单重开（整树重挂载）时失效：涂色改为全量扫描 + 任意 DOM 变化节流重涂，面板未上报档位时从档位文本反推颜色。
>
> 🆕 **v0.2.1** — 面板关闭后，模型菜单「推理等级」行上的档位值沿用档位色（OFF 粉灰 / Low 橙金 / Medium 蓝 / High 紫 / Ultracode 亮紫辉光）。
>
> ✨ **v0.2.0** — 任何自定义第三方模型/提供商都支持思考强度调节，且线上真实生效（适配器元数据供给 + pi-ai 线级供给，热生效）。
>
> 🎛️ **v0.1.0** — 初始版本：拦截官方「推理等级」菜单，弹出仿 Claude Code 的 Effort 滑块面板。

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

### 通用思考强度（v0.2.0）

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

## 兼容性

| 项目 | 值 |
| --- | --- |
| DSH 版本 | 官方安装版 web profile（Windows 验证） |
| 安装机制 | `dsh plugin --profile web add`（bundle patch + 双半区） |
| 依赖 | `dsh-base` / `dsh-web-app` 的 client runtime / connection / sessions 通道 |

## 安装 / 卸载

```sh
# 安装（推荐，与 dsh-navbar 等同一 bundle 机制）
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# 本地构建后安装（克隆本仓库）
pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> 安装后**重启 DeepSeek Harness**，并在 Web 页面按一次 **Ctrl+F5**。
> `lib/` 构建产物已提交，GitHub 安装无需本地构建。

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
| 插件级选项 | `effort-slider` 设置段（写入 `~/.dsh/settings.yaml` 即热生效） |
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
| 网络 | 无 — 浏览器半区只与本机 DSH `/api` RPC 端点通信 |
| 凭据 | 永不读取 |
| 用户数据 | 不读取（不接触会话内容/消息/提示词；仅经 sessions 通道读写当前会话的 `reasoningEffort`） |

## 工作原理

| 半区 | 文件 | 职责 |
| --- | --- | --- |
| 宿主 | `lib/index.js` | 通用思考强度供给：适配器元数据包装（`universalReasoning`）+ pi-ai 线级补丁（`buildProvisionOps`，幂等、尊重用户声明）+ `effort-slider` 设置段；监听 `llm/adapters-updated` / `settings/updated` 热生效 |
| 浏览器 | `lib/client.js` | 捕获阶段拦截模型菜单「推理等级」行 → 弹出 Effort 面板；拖动节流写入 `selectModel({ reasoningEffort })`；面板关闭后经 MutationObserver 守护菜单行档位色 |

> 浏览器半区遵循官方外部插件约定：经典脚本 + `window.__ModuleLoader__.load` 工厂；
> `react` / `react-dom/client` / `react/jsx-runtime` 走平台 externals；
> `effort.module.css` 由 lightningcss 哈希类名并内联，在工厂执行时注入 `<style data-plugin>`。

## 常见问题

| 现象 | 解决 |
| --- | --- |
| 模型菜单没有「推理等级」行 | 该模型未声明 reasoning 元数据且宿主供给未生效 — 确认重启过 DSH，并检查 `~/.dsh/settings.yaml` 的 `effort-slider.enabled` |
| 面板显示「当前模型不支持思考强度调节」 | 通用兜底未启用 — 升级到 v0.2.0+ 并重启 |
| 拖动后档位不生效 | 检查目标端点的线方言是否匹配（见上方方言表），或为该路由显式设置 `defaultDialect` |
| 与其它皮肤插件冲突 | 若同时安装了会拦截「推理等级」行的皮肤（如 dsh-ui-web 系列的 aurora），需将其拦截段禁用，避免双面板 |
| 重启后版本仍显示旧版 | `file:` 安装是快照拷贝 — 用 `github:` 安装或重跑 add 后再重启 |
| 日志在哪 | 宿主错误看 DSH 启动日志；客户端错误看浏览器 DevTools（F12）Console |

## 结构

```text
src/
  index.ts                  宿主半区：通用思考强度供给（适配器元数据包装 + pi-ai 线级供给 + 设置段）
  effort-core.ts             纯逻辑：方言 → 线级映射、供给补丁生成（单测覆盖）
  client/
    index.ts                浏览器半区：拦截模型菜单「推理等级」行 + 面板锚点挂载 + 菜单行着色
    css-modules.d.ts
    effort/
      EffortPanel.tsx       Effort 面板（档位/刻度/滑块/辉光）
      useWebglFire.ts       WebGL2 三通道火焰循环（弹簧跟随 + 空闲休眠）
      shaders.ts            顶点/点火/模糊/合成着色器
      effortColors.ts       档位 → 颜色映射（面板与菜单行共用）
      effort.module.css     面板样式（lightningcss 内联注入）
cordis.patch.yml           bundle 补丁（insert ui-effort-slider 行）
lib/                       构建产物（client.js 附带 sourcemap）
test/                      host.spec.mjs 宿主单测 + client.smoke.mjs 冒烟测试
```

## 开发

```sh
pnpm install
pnpm build   # tsdown → lib/index.js（宿主半区）+ lib/client.js（浏览器半区）
pnpm test    # 宿主单测（方言/补丁幂等）+ jsdom 冒烟（拦截/渲染/吸附/兜底刻度/着色/回收）
```

**贡献.** Fork → 修改 → `pnpm build` → 跑 `pnpm test` → 向 `main` 开 PR。小修复（文档、测试）无需事先讨论；报告问题时附 DSH 版本与具体报错。

## 许可证与安全

**许可证**：BSD-3-Clause — 见 [LICENSE](LICENSE)。
界面实现参考了社区 dsh-ui-web 项目的 aurora 皮肤（BSD-3-Clause），完整上游声明与许可证原文见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**安全**：本插件不读取任何凭据、不发送任何网络数据（仅与本机 DSH 通信）。安全问题的私下报告请使用
GitHub Security tab 的 **Report a vulnerability**，勿公开张贴利用细节。

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
