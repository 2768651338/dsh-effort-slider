<!-- English version. 中文文档见 docs/lang/README_ZH.md -->
<div align="center">

# dsh-effort-slider

> **A Claude Code–style reasoning-effort slider for DeepSeek Harness** — click **Effort** in the model menu, drag without steps, snap on release, with a WebGL fire trail; any third-party model/provider gets real, working thinking-effort control.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

[**中文**](docs/lang/README_ZH.md)

</div>

Click the **Effort** row (second row of the official model menu) instead of the built-in level list: an **Effort slider panel** pops up — OFF/MAX scale ticks, Low/Medium/High/Ultracode status shown live, and after the panel closes the effort value stays color-coded on the menu row and on the model-seat trigger button.

[Features](#features) · [Compatibility](#compatibility) · [Install / Uninstall](#install--uninstall) · [Quick Start](#quick-start) · [Configuration](#configuration) · [Permissions & Data](#permissions--data) · [How It Works](#how-it-works) · [Troubleshooting](#troubleshooting) · [Development](#development)

**Demo screenshots** (menu-row coloring / model-seat trigger / Effort panel — effort level is color-coded):

| Menu row | Model-seat trigger | Effort panel |
| --- | --- | --- |
| <img src="assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="Effort menu row colored" width="240"> | <img src="assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="Model-seat trigger colored" width="240"> | <img src="assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Effort slider panel" width="240"> |

---

> 🆕 **v0.3.0 (DSH 0.1.5)** — Ported to the current DeepSeek Harness API. `@deepseek-ai/dsh-client-runtime` no longer exists, so the browser half now takes its `Context` from `@deepseek-ai/cordis`; `ConnectionHandle` no longer exposes `.api`, so the panel reads and writes the per-session shared directory through `ctx.modelDirectories` (the same state the official `/model` popup and composer model seat use); the host half installs its settings section through `settings.installSection()` (`installSettingsSection` / `settingsNamespace` are gone), and since `llm.adapters` is now private the redundant adapter-metadata wrapper was dropped — pi-ai `reasoningEfforts` provisioning alone supplies both the wire fields **and** the catalog `reasoning` metadata. `pnpm typecheck` is green again (218 → 0 errors).
>
> 🔧 **v0.2.5** — Fixed the real landing bug in universal effort provisioning: explicit `models` arrays are now replaced as a whole (dsh-settings path ops cannot traverse array nodes, otherwise `models` is corrupted, the schema rejects the write, and provisioning fails silently).
>
> 🔧 **v0.2.4** — Fixed universal effort provisioning never landing when the pi-ai settings section registers late: provisioning now retries until the section is ready (registration happens after the adapter and does not emit `settings/updated`).
>
> 🆕 **v0.2.3** — The model-seat trigger button (「model · effort」 above the composer) also color-codes its effort name, persistent after the menu closes.
>
> 🔧 **v0.2.2** — Fixed menu-row coloring breaking on whole-tree menu remounts: painting now does a full scan and re-paints on any DOM change (throttled), and infers the color from the effort text when the panel has not reported one yet.
>
> 🆕 **v0.2.1** — After the panel closes, the effort value on the model menu's Effort row keeps its level color (OFF rose-gray / Low amber / Medium blue / High purple / Ultracode bright purple with glow).
>
> ✨ **v0.2.0** — Any custom third-party model/provider gets working thinking-effort control (adapter metadata provisioning + pi-ai wire-level provisioning, hot-applied).
>
> 🎛️ **v0.1.0** — Initial release: intercepts the official Effort menu and shows a Claude Code–style Effort slider panel.

---

## Features

| Feature | Description |
| --- | --- |
| 🎚️ Stepless dragging | Continuous 0–100 dragging that writes `reasoningEffort` in real time (16 ms throttle, no request pile-up while dragging) |
| 🎯 Snap on release | Snaps to the nearest level on release / blur / keyboard end, with one confirmation write |
| 🔥 WebGL fire trail | Three-pass shaders (ignite → blur → composite); the fire front follows the thumb with spring damping |
| 🏁 OFF/MAX ticks | First/last levels always show `OFF` / `MAX`; middle levels show the API-returned name |
| 🎨 Level status | Effort name shown in the panel header, colored/glowing per level; menu row and model-seat trigger keep the same color after closing (v0.2.3) |
| 🌐 Universal effort | Third-party models without `reasoning` metadata automatically get the universal 5-level scale; pi-ai models get wire-level dictionaries patched in, **hot-applied** (v0.2.0) |

Only `reasoningEffort` is written — model selection is untouched. Models with no multi-level reasoning show 「当前模型不提供多档推理等级」 (no multi-level reasoning available).

### Universal effort provisioning (v0.2.0, simplified in v0.3.0)

**Any custom third-party model/provider gets thinking-effort control that actually works on the wire**:

- **Wire-level provisioning (host, pi-ai)**: for `llm-pi-ai` models missing `reasoningEfforts`, the dictionary and `compat` wire dialect
  are patched in (**hot-applied, no restart**); pi-ai translates the level into real wire fields
  (`reasoning_effort` / `thinking` / OpenRouter `reasoning.effort`, etc.) **and** advertises the same declaration as the model's
  `reasoning` catalog metadata — which is what makes the official **Effort** row appear for a hand-declared model at all;
- **Client fallback scale**: if the directory returns no reasoning metadata, the panel still opens with the universal 5-level scale;
- Existing user declarations (`reasoningEfforts: false` or a custom dictionary) are always respected and never overwritten.

> **Why there is no adapter wrapper any more.** Up to v0.2.5 the host half also wrapped each adapter's `resolveModel` to inject
> `universalReasoning` into models that declared no `reasoning` metadata. DSH 0.1.5 made `llm.adapters` a private field with no
> public accessor, so that path is impossible — and unnecessary: `reasoningEfforts` is the one declaration that feeds both the
> request wire and the model catalog. Model-level `compat` is only written when the route declares `api: openai-completions`,
> because pi-ai refuses a switch the model's protocol cannot read.

Supported wire dialects for custom endpoints (set `effort-slider.defaultDialect` or `routes.<route>`):

| Dialect | Wire effect |
| --- | --- |
| `effort` (default) | OpenAI-style `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}` toggle + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }` (OpenRouter normalized) |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + optional effort |
| `qwen` | `enable_thinking` toggle |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort` strings |

## Compatibility

| Item | Value |
| --- | --- |
| DSH version | **0.1.5-rc.1** (the npm `latest` dist-tag; the version this build is verified against), web profile on Windows |
| Broken on | DSH ≤ 0.1.1 — v0.2.5 and earlier import `@deepseek-ai/dsh-client-runtime`, which was removed after 0.1.1-rc.2 |
| Install mechanism | `dsh plugin --profile web add` (bundle patch + dual half) |
| Depends on | `ctx.sessions` (`@deepseek-ai/dsh-api-session-controller`) and `ctx.modelDirectories` (`@deepseek-ai/dsh-client-ui-model-selection`); host: `ctx.llm`, `ctx.settings` |
| Client module requests | none beyond the platform baseline (`react`, `react-dom/client`, `react/jsx-runtime`) — all DSH imports are type-only and erased |

## Install / Uninstall

```sh
# Install from GitHub (the committed lib/ artifacts need no local build)
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# Or build locally and install from a checkout
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> After installing, **restart DeepSeek Harness** and press **Ctrl+F5** once in the web page.
> The `lib/` artifacts are committed, so GitHub installs need no local build.

**Coming from a version pinned to an old DSH?** Remove any `- id: ui-effort-slider` / `disabled: true`
row from `~/.dsh/profiles/web/cordis.patch.yml`, otherwise the new build stays switched off.

| Action | Command |
| --- | --- |
| Upgrade | `dsh plugin --profile web update dsh-effort-slider` (or re-run `add`), then restart DSH |
| Uninstall | `dsh plugin --profile web remove dsh-effort-slider`, then remove its row from `cordis.patch.yml` if any |

## Quick Start

1. Install the plugin, restart DSH, press `Ctrl+F5`.
2. Open the model menu above the composer → click **Effort** → the Effort slider panel appears.
3. Drag to choose a level; it snaps on release. After the panel closes, the effort value keeps its color on the menu row.
4. For custom models with no thinking effort, the panel opens with the universal 5-level scale; pi-ai models get their wire dictionaries patched on the host side (hot-applied).

A `[effort-slider] intercept row: ...` line in DevTools Console means interception is working.

## Configuration

| Item | Details |
| --- | --- |
| Plugin options | `effort-slider` settings section (written to `~/.dsh/settings.yaml`, hot-applied) |
| Defaults | `enabled: true`, `defaultDialect: effort` |
| Environment variables | None of its own; follows DSH's `DSH_HOME` resolution |
| Sensitive items | None — no keys, tokens, or credentials are read or stored |

```yaml
effort-slider:
  enabled: true          # provisioning master switch
  defaultDialect: effort # global default wire dialect
  routes:
    my-gateway: deepseek # per-route override
```

## Permissions & Data

| Scope | What it touches |
| --- | --- |
| Files (read) | None — no user files are read or written (settings go through DSH's settings service) |
| Network | None of its own — the panel reads and writes the Model Controller's in-browser directory; the resulting `session.selectModel` call rides DSH's existing connection |
| Credentials | Never read |
| User data | Not read (no access to conversation content/messages/prompts; only the current session's provider/model/`reasoningEffort` through the shared model directory) |

## How It Works

| Half | File | Role |
| --- | --- | --- |
| Host | `lib/index.js` | Universal effort provisioning: pi-ai wire patches (`buildProvisionOps`, idempotent, respects user declarations) + the `effort-slider` settings section installed via `settings.installSection`; listens to `llm/adapters-updated` / `settings/updated` for hot application |
| Browser | `lib/client.js` | Captures clicks on the model menu's Effort row → shows the Effort panel; reads `ctx.modelDirectories.directoryFor(sessionId)` and writes through `directory.select({ reasoningEffort })`; a MutationObserver keeps the menu-row level color alive after the panel closes |

> The browser half follows the official external-plugin convention: classic script + `window.__ModuleLoader__.load` factory;
> `react` / `react-dom/client` / `react/jsx-runtime` are platform externals;
> `effort.module.css` is hashed and inlined by lightningcss, injected as `<style data-plugin>` when the factory runs.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No Effort row in the model menu | The model declares no reasoning metadata and host provisioning is not in effect — confirm DSH was restarted and check `effort-slider.enabled` in `~/.dsh/settings.yaml` |
| Panel says 「当前模型不支持思考强度调节」 | Universal fallback not active — upgrade to v0.2.0+ and restart |
| Plugin does not load at all (row shows `disabled: true`) | An earlier build was switched off in `~/.dsh/profiles/web/cordis.patch.yml`; delete that row and restart |
| Dragging has no effect | Check whether the target endpoint's wire dialect matches (see the dialect table) or set `defaultDialect` for that route |
| Conflicts with other skin plugins | If another skin that intercepts the Effort row is installed (e.g. the aurora skin of dsh-ui-web), disable its interception to avoid double panels |
| Version still shows old after restart | `file:` installs are snapshot copies — use the `github:` spec or re-run `add` before restarting |
| Where are the logs? | Host errors: DSH startup log; client errors: browser DevTools (F12) Console (`[effort-slider]` prefix) |

## Project Structure

```text
src/
  index.ts                  host half: pi-ai wire provisioning + settings section
  effort-core.ts             pure logic: dialect → wire mapping, provisioning patches (unit-tested)
  client/
    index.ts                browser half: intercept the Effort row + panel anchor + menu-row coloring
    css-modules.d.ts
    effort/
      directory.ts          structural face of ctx.modelDirectories / ctx.sessions (type-only, no DSH runtime import)
      EffortPanel.tsx       Effort panel (levels / ticks / slider / glow)
      useWebglFire.ts       WebGL2 three-pass fire loop (spring follow + idle sleep)
      shaders.ts             vertex / ignite / blur / composite shaders
      effortColors.ts        level → color mapping (panel and menu row share it)
      effort.module.css      panel styles (inlined via lightningcss)
cordis.patch.yml           bundle patch (inserts the ui-effort-slider row)
lib/                        built artifacts (client.js ships with sourcemap)
test/                      host.spec.mjs unit tests + host-apply.spec.mjs + client.smoke.mjs
```

## Development

```sh
pnpm install
pnpm build       # tsdown → lib/index.js (host half) + lib/client.js (browser half)
pnpm typecheck   # tsc --noEmit (green against @deepseek-ai/* 0.1.5-rc.1)
pnpm test        # host unit tests + apply integration test + real-seam integration test + jsdom smoke
```

`test/` layers, cheapest first:

| File | Scope |
| --- | --- |
| `host.spec.mjs` | Pure logic: dialect → wire mapping, provisioning patch generation, idempotency |
| `host-apply.spec.mjs` | `apply()` against a mocked cordis context: late pi-ai section retry, `compat` gating on the declared protocol |
| `host-integration.spec.mjs` | **Real seam**: real `@deepseek-ai/cordis` + real `@deepseek-ai/dsh-settings-file` provider — `installSection` registration, real path-op writes landing in a settings document, and the written `reasoningEfforts`/`compat` passing pi-ai's validation rules |
| `client.smoke.mjs` | jsdom: bundle factory materialization, Effort-row interception, panel render, drag/snap writes through `directory.select`, coloring, teardown |

**Contributing.** Fork → change → `pnpm build` → run `pnpm test` → open a PR against `main`. Small fixes (docs, tests) are welcome without prior discussion; report issues with the DSH version and the exact error.

## License & Security

**License**: BSD-3-Clause — see [LICENSE](LICENSE).
The UI implementation references the aurora skin of the community dsh-ui-web project (BSD-3-Clause); full upstream notices and license texts are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Security**: this plugin reads no credentials and sends nothing over the network (only talks to the local DSH). To report a security issue privately, use GitHub's **Report a vulnerability** on the Security tab — do not open a public issue with exploit details.

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
