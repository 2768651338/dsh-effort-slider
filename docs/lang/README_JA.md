<!-- 日本語版。English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · [中文](README_ZH.md) · [Español](README_ES.md) · **日本語** · [Deutsch](README_DE.md) · [Русский](README_RU.md) · [Português](README_PT.md) · [한국어](README_KO.md)

</div>

> ※ このドキュメントは[英語版](../../README.md)の翻訳です。内容に差異がある場合は英語版が正となります。誤訳・古い記述の修正は Issue / PR で歓迎します。

<div align="center">

# dsh-effort-slider

> **DeepSeek Harness 向け Claude Code 風の推論エフォートスライダー** — モデルメニューの **Effort** をクリック、段階なしでドラッグ、指を離すとスナップ、WebGL の炎が追従。サードパーティーのモデル/プロバイダーでも思考エフォート制御が実際に機能します。

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

公式モデルメニューの 2 行目にある **Effort** 行をクリックすると、内蔵のレベルリストの代わりに **Effort スライダーパネル**がポップアップします — OFF/MAX の目盛り、Low/Medium/High/Ultracode の状態をリアルタイム表示。パネルを閉じた後も、エフォート値はメニュー行とモデルシートのトリガーボタンの上にレベル色のまま残ります。

[機能](#機能) · [互換性](#互換性) · [インストール / アンインストール](#インストール--アンインストール) · [クイックスタート](#クイックスタート) · [設定](#設定) · [権限とデータ](#権限とデータ) · [動作の仕組み](#動作の仕組み) · [トラブルシューティング](#トラブルシューティング) · [開発](#開発)

**デモスクリーンショット**（メニュー行の着色 / モデルシートトリガー / Effort パネル — レベルに応じて着色）：

| メニュー行 | モデルシートトリガー | Effort パネル |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="モデルメニューの Effort 行の着色" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="モデルシートトリガーの着色" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Effort スライダーパネル" width="240"> |

</div>

---

> 🆕 **v0.4.0** — DSH **0.2.0** へ移植：DSH は settings サービスを `SettingsForms` に置き換えました（設定は profile entry 設定になり、`installSection` / `settings.get` / `settings/updated` は廃止）。ホスト側は pi-ai の profile entry（`llm-pi-ai`）を特定し、`settings.describe()` で読み取り、`settings.mutate()` で書き込み、`settings/document-updated` を監視します。クライアント側は `retainedBy.mainView` から現在のセッションを導出します（`SessionListState.current` は削除済み）。プラグインオプション（`enabled` / `defaultDialect` / `routes`）はプラグインの entry 設定に置かれ、DSH の設定ページで編集できます。DSH ≤ 0.1.5 はサポート外（そちらでは v0.3.0 を使用）。
>
> 🆕 **v0.3.0** — DSH 0.1.5 へ移植：クライアントの `Context` は `@deepseek-ai/cordis` から取得、セッション状態は `ctx.modelDirectories` 経由で読み書き、設定セクションは `settings.installSection()` でインストール。不可能になったアダプターメタデータラッパーは削除（下記「汎用エフォート供給」参照）。DSH ≤ 0.1.1 はサポート外に。
>
> 🔧 **v0.2.5** — 明示的な `models` 配列で汎用プロビジョニングが静かに失敗する問題を修正（dsh-settings の path 操作は配列ノードを走査できないため、配列ごと置き換える方式に変更）。
>
> 🔧 **v0.2.4** — pi-ai 設定セクションの遅延登録により汎用プロビジョニングが反映されない問題を修正（セクションの準備ができるまでリトライする方式に変更）。
>
> 🆕 **v0.2.3** — モデルシートのトリガーボタンもエフォート名をレベル色で着色、メニューを閉じた後も維持。
>
> 🔧 **v0.2.2** — メニュー全体の再マウントでメニュー行の着色が壊れる問題を修正（全体スキャンのスロットル付き再描画、エフォートテキストからの色推定）。
>
> 🆕 **v0.2.1** — パネルを閉じた後、モデルメニューの Effort 行のエフォート値がレベル色を保持。
>
> ✨ **v0.2.0** — カスタムのサードパーティーモデル/プロバイダーでも思考エフォート制御が実際に機能（ホット適用）。
>
> 🎛️ **v0.1.0** — 初期リリース：公式の Effort メニューをインターセプトし、Claude Code 風の Effort スライダーパネルを表示。
>
> 各バージョンの詳細: [Releases](https://github.com/2768651338/dsh-effort-slider/releases)

---

## 機能

| 機能 | 説明 |
| --- | --- |
| 🎚️ 無段階ドラッグ | 0–100 を連続ドラッグし、`reasoningEffort` をリアルタイムに書き込み（16ms スロットル、ドラッグ中にリクエストが滞積しない） |
| 🎯 指を離すとスナップ | 離す/フォーカス喪失/キーボード操作の終了で最寄りのレベルにスナップし、確認の書き込みを 1 回補送 |
| 🔥 WebGL 炎の軌跡 | 3 パスのシェーダー（着火 → ぼかし → 合成）。炎の先端はバネ減衰でつまみに追従 |
| 🏁 OFF/MAX 目盛り | 最初と最後のレベルは常に `OFF` / `MAX` を表示し、中間レベルは API が返した名前を表示 |
| 🎨 レベル表示 | レベル名はパネルヘッダーにリアルタイム表示され、レベルに応じて色/グローが変化。パネルを閉じた後もメニュー行とモデルシートのトリガーが同じ色を保持（v0.2.3） |
| 🌐 汎用エフォート | `reasoning` メタデータを宣言していないサードパーティーモデルには汎用 5 段階スケールを自動付与。pi-ai モデルにはワイヤレベルの辞書を自動補完、**ホット適用**（v0.2.0） |

書き込むのは `reasoningEffort` のみで、モデル選択には触れません。複数段階の推論を持たないモデルには「当前模型不提供多档推理等级」（多段階の推論レベルなし）と表示されます。

### 汎用エフォート供給（v0.2.0、v0.3.0 で簡素化）

**カスタムのサードパーティーモデル/プロバイダーでも、思考エフォート制御がワイヤ上で実際に機能します**：

- **ワイヤレベル供給（ホスト側、pi-ai）**：`llm-pi-ai` 設定で `reasoningEfforts` を欠くカスタムモデルに対し、辞書と `compat` ワイヤ方言を自動補完（**ホット適用、再起動不要**）。pi-ai がレベルを実際のワイヤフィールド（`reasoning_effort` / `thinking` / OpenRouter の `reasoning.effort` など）へ翻訳し、**同じ宣言をモデルの `reasoning` カタログメタデータとしても公開**します — 手動宣言のモデルに公式の **Effort** 行が現れるのはこのためです；
- **クライアント側フォールバックスケール**：ディレクトリが reasoning メタデータを返さなくても、パネルは汎用 5 段階スケールで開きます；
- ユーザーが既に持つ宣言（`reasoningEfforts: false` やカスタム辞書）は常に尊重され、上書きされません。

> **なぜアダプターラッパーがなくなったのか。** v0.2.5 まで、ホスト側は各アダプターの `resolveModel` をラップし、`reasoning` メタデータを宣言しないモデルへ `universalReasoning` を注入していました。DSH 0.1.5 で `llm.adapters` が公開アクセサーのない非公開フィールドになり、この経路は不可能になりました — そして不要にもなりました。`reasoningEfforts` は「リクエストのワイヤ」と「モデルカタログ」の両方に効く唯一の宣言だからです。モデルレベルの `compat` は、ルートが `api: openai-completions` を宣言している場合にのみ書き込まれます。pi-ai は「そのモデルのプロトコルが読めないスイッチ」を拒否するためです。

カスタムエンドポイントで対応するワイヤ方言（`effort-slider.defaultDialect` または `routes.<ルート>` で設定）：

| 方言 | ワイヤ上の効果 |
| --- | --- |
| `effort`（既定） | OpenAI 方式の `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}` トグル + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }`（OpenRouter 正規化） |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + 任意の effort |
| `qwen` | `enable_thinking` トグル |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort` 文字列 |

## 互換性

| 項目 | 値 |
| --- | --- |
| DSH バージョン | **0.2.0-rc.2**（npm `latest` dist-tag。このビルドが検証対象としたバージョン）、Windows の web プロファイル |
| 動作しない | DSH ≤ 0.1.5 — v0.4.0 は 0.2.0 で導入された `SettingsForms` settings サービスを対象とします（DSH 0.1.5 には v0.3.0 を使用。v0.2.5 以前はさらに `@deepseek-ai/dsh-client-runtime` を import しますが、このパッケージは 0.1.1-rc.2 以降に削除されました） |
| インストール機構 | `dsh plugin --profile web add`（バンドルパッチ + ホスト/ブラウザの 2 半区） |
| 依存 | `ctx.sessions`（`@deepseek-ai/dsh-api-session-controller`）と `ctx.modelDirectories`（`@deepseek-ai/dsh-client-ui-model-selection`）。ホスト側：`ctx.llm`、`ctx.settings`（`SettingsForms`） |
| クライアントのモジュール要求 | プラットフォーム基盤（`react` / `react-dom/client` / `react/jsx-runtime`）以外なし — DSH の import はすべて型のみで、バンドル時に消去されます |

## インストール / アンインストール

```sh
# GitHub からインストール（lib/ のビルド成果物はコミット済み、ローカルビルド不要）
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# またはローカルでビルドしてチェックアウトからインストール
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> インストール後、**DeepSeek Harness を再起動**し、Web ページで一度 **Ctrl+F5** を押してください。
> `lib/` 成果物はコミット済みのため、GitHub インストールにローカルビルドは不要です。

**古い DSH に固定されたバージョンから移行する場合** `~/.dsh/profiles/web/cordis.patch.yml` にある `- id: ui-effort-slider` / `disabled: true` の行を削除してください。削除しないと新しいビルドは無効のままです。

| 操作 | コマンド |
| --- | --- |
| アップグレード | `dsh plugin --profile web update dsh-effort-slider`（または `add` を再実行）、その後 DSH を再起動 |
| アンインストール | `dsh plugin --profile web remove dsh-effort-slider`、`cordis.patch.yml` にその行があれば削除 |

## クイックスタート

1. プラグインをインストールし、DSH を再起動、`Ctrl+F5` を押します。
2. コンポーザー上のモデルメニューを開く → **Effort** をクリック → Effort スライダーパネルが表示されます。
3. ドラッグでレベルを選び、離すとスナップ。パネルを閉じた後もメニュー行のエフォート値はレベル色を保ちます。
4. 思考エフォートのないカスタムモデルでは、パネルが汎用 5 段階スケールで開きます。pi-ai モデルはホスト側でワイヤ辞書を自動補完（ホット適用）します。

DevTools Console に `[effort-slider] intercept row: ...` と出ればインターセプト成功です。

## 設定

| 項目 | 詳細 |
| --- | --- |
| プラグインオプション | プラグインの profile entry 設定（`enabled` / `defaultDialect` / `routes`）。DSH の設定ページ（自動生成フォーム）で編集でき、プラグインの再マウント時に適用 |
| 既定値 | `enabled: true`、`defaultDialect: effort` |
| 環境変数 | 自前のものなし。DSH の `DSH_HOME` 解決に従う |
| 機密項目 | なし — キー/トークン/資格情報は読み取りも保存もしません |

```yaml
effort-slider:
  enabled: true          # プロビジョニングのマスタースイッチ
  defaultDialect: effort # グローバルの既定ワイヤ方言
  routes:
    my-gateway: deepseek # ルートごとの上書き
```

## 権限とデータ

| スコープ | 内容 |
| --- | --- |
| ファイル（読み取り） | なし — ユーザーファイルの読み書きなし（設定は DSH の settings サービス経由） |
| ネットワーク | 自前のリクエストなし — パネルはブラウザ内の Model Controller 共有ディレクトリを読み書きし、最終的な `session.selectModel` 呼び出しは DSH の既存接続に乗ります |
| 資格情報 | 読み取りません |
| ユーザーデータ | 読み取りません（会話内容/メッセージ/プロンプトには接触しません。共有モデルディレクトリ経由で現在セッションの provider/model/`reasoningEffort` のみ扱います） |

## 動作の仕組み

| 半区 | ファイル | 役割 |
| --- | --- | --- |
| ホスト | `lib/index.js` | 汎用エフォート供給：pi-ai の profile entry（`llm-pi-ai`）を特定し、`settings.describe()` で読み取り、`settings.mutate` でワイヤ方言を補完（`buildProvisionOps`、冪等、ユーザー宣言を尊重）。`llm/adapters-updated` / `settings/document-updated` を監視 |
| ブラウザ | `lib/client.js` | モデルメニューの Effort 行のクリックをキャプチャ → Effort パネルを表示。`ctx.modelDirectories.directoryFor(sessionId)` で読み取り、`directory.select({ reasoningEffort })` で書き込み。パネルを閉じた後は MutationObserver がメニュー行のレベル色を守ります |

> ブラウザ側は公式の外部プラグイン規約に従います：クラシックスクリプト + `window.__ModuleLoader__.load` ファクトリー。`react` / `react-dom/client` / `react/jsx-runtime` はプラットフォーム externals。`effort.module.css` は lightningcss がクラス名をハッシュ化してインライン化し、ファクトリー実行時に `<style data-plugin>` として注入します。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| モデルメニューに Effort 行がない | モデルが reasoning メタデータを宣言しておらず、ホスト供給も効いていません — DSH の再起動を確認し、プラグインの設定ページ（その profile entry 設定）で `enabled` を確認 |
| パネルに「当前模型不支持思考强度调节」と出る | 汎用フォールバックが有効でありません — v0.2.0+ にアップグレードして再起動 |
| プラグインがまったく読み込まれない（行が `disabled: true`） | 旧ビルドが `~/.dsh/profiles/web/cordis.patch.yml` で無効化されていました。その行を削除して再起動 |
| ドラッグしても効かない | 対象エンドポイントのワイヤ方言が一致しているか確認（方言表を参照）。またはそのルートに `defaultDialect` を明示設定 |
| 他のスキンプラグインと競合する | Effort 行をインターセプトするスキン（dsh-ui-web 系の aurora など）が同時にインストールされている場合、そのインターセプトを無効化して二重パネルを回避 |
| 再起動後もバージョンが古いまま | `file:` インストールはスナップショットコピーです — `github:` でインストールするか `add` を再実行してから再起動 |
| ログはどこに？ | ホスト側のエラー: DSH 起動ログ。クライアント側: ブラウザ DevTools（F12）Console（`[effort-slider]` プレフィックス） |

## プロジェクト構成

```text
src/
  index.ts                  ホスト半区：SettingsForms シーム経由の pi-ai ワイヤ供給
  effort-core.ts             純ロジック：方言 → ワイヤマッピング、供給パッチ生成（単体テスト済み）
  client/
    index.ts                ブラウザ半区：モデルメニューの Effort 行インターセプト + パネルアンカー + メニュー行の着色
    css-modules.d.ts
    effort/
      directory.ts          ctx.modelDirectories / ctx.sessions の構造面（型のみ、DSH ランタイムを import しない）
      EffortPanel.tsx       Effort パネル（レベル / 目盛り / スライダー / グロー）
      useWebglFire.ts       WebGL2 3 パス炎ループ（バネ追従 + アイドル休止）
      shaders.ts            頂点 / 着火 / ぼかし / 合成シェーダー
      effortColors.ts       レベル → 色マッピング（パネルとメニュー行で共用）
      effort.module.css     パネルスタイル（lightningcss でインライン注入）
cordis.patch.yml           バンドルパッチ（ui-effort-slider 行を挿入）
lib/                       ビルド成果物（client.js はソースマップ付き）
test/                      host.spec.mjs ホスト単体 + host-apply.spec.mjs + client.smoke.mjs
```

## 開発

```sh
pnpm install
pnpm build       # tsdown → lib/index.js（ホスト半区）+ lib/client.js（ブラウザ半区）
pnpm typecheck   # tsc --noEmit（@deepseek-ai/* 0.2.0-rc.2 に対してグリーン）
pnpm test        # ホスト単体 + apply 結合 + リアムシーム結合 + jsdom スモーク
```

`test/` の 4 層、安価な順に：

| ファイル | カバー範囲 |
| --- | --- |
| `host.spec.mjs` | 純ロジック：方言 → ワイヤマッピング、供給パッチ生成、冪等性 |
| `host-apply.spec.mjs` | mock cordis コンテキストでの `apply()`：pi-ai entry の遅延登録リトライ、宣言プロトコルによる `compat` のゲーティング、`settings/document-updated` の冪等性 |
| `host-integration.spec.mjs` | **リアルシーム**：実 `@deepseek-ai/cordis` + 忠実な `SettingsForms` シームのテストダブル（0.2.0 の npm パッケージにスタンドアロンのプロバイダーはない）— entry の発見、実 path-op による profile entry 設定への書き込み、書き出された `reasoningEfforts`/`compat` が pi-ai の検証ルールを通ること |
| `client.smoke.mjs` | jsdom：バンドルファクトリーの実体化、Effort 行のインターセプト、パネル描画、`directory.select` 経由のドラッグ/スナップ書き込み、着色、アンマウント時の回収 |

**コントリビュート.** Fork → 変更 → `pnpm build` → `pnpm test` を実行 → `main` へ PR。小さな修正（ドキュメント、テスト）は事前相談なしで歓迎します。Issue には DSH バージョンと具体的なエラーを添えてください。

## ライセンスとセキュリティ

**ライセンス**: BSD-3-Clause — [LICENSE](../../LICENSE) を参照。
UI 実装はコミュニティ dsh-ui-web プロジェクトの aurora スキン（BSD-3-Clause）を参考にしました。完全な上流表示とライセンス原文は
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) を参照してください。

**セキュリティ**: 本プラグインは資格情報を読まず、ネットワークへ何も送信しません（ローカルの DSH とだけ通信します）。セキュリティ問題の非公開報告は GitHub Security タブの **Report a vulnerability** をご利用ください。悪用の詳細を公開 Issue に書かないでください。

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
