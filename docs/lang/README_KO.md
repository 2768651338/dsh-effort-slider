<!-- 한국어판. English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · [中文](README_ZH.md) · [Español](README_ES.md) · [日本語](README_JA.md) · [Deutsch](README_DE.md) · [Русский](README_RU.md) · [Português](README_PT.md) · **한국어**

</div>

> ※ 이 문서는 [영어판](../../README.md)의 번역본입니다. 내용이 다르면 영어판이 기준입니다. 오역·오래된 내용은 Issue / PR로 수정을 환영합니다.

<div align="center">

# dsh-effort-slider

> **DeepSeek Harness를 위한 Claude Code 스타일 추론 에포트 슬라이더** — 모델 메뉴의 **Effort**를 클릭하고, 단계 없이 드래그하고, 손을 떼면 스냅되며, WebGL 불꽃이 따라옵니다. 서드파티 모델/프로바이더에서도 추론 에포트 제어가 실제로 작동합니다.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

공식 모델 메뉴 두 번째 줄의 **Effort** 행을 클릭하면 내장 단계 목록 대신 **Effort 슬라이더 패널**이 뜹니다 — OFF/MAX 눈금, Low/Medium/High/Ultracode 상태가 실시간 표시되고, 패널을 닫은 후에도 에포트 값은 메뉴 행과 모델 시트 트리거 버튼 위에 단계 색으로 남습니다.

[기능](#기능) · [호환성](#호환성) · [설치 / 제거](#설치--제거) · [빠른 시작](#빠른-시작) · [설정](#설정) · [권한과 데이터](#권한과-데이터) · [동작 방식](#동작-방식) · [문제 해결](#문제-해결) · [개발](#개발)

**데모 스크린샷**（메뉴 행 색칠 / 모델 시트 트리거 / Effort 패널 — 단계에 따라 색칠）:

| 메뉴 행 | 모델 시트 트리거 | Effort 패널 |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="모델 메뉴 Effort 행 색칠" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="모델 시트 트리거 색칠" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Effort 슬라이더 패널" width="240"> |

</div>

---

> 🆕 **v0.3.0** — DSH 0.1.5 대응: 클라이언트 `Context`는 `@deepseek-ai/cordis`에서 가져오고, 세션 상태는 `ctx.modelDirectories`로 읽고 쓰며, 설정 섹션은 `settings.installSection()`으로 설치합니다. 더 이상 불가능해진 어댑터 메타데이터 래퍼는 삭제（아래 「범용 에포트 프로비저닝」 참조). DSH ≤ 0.1.1은 미지원.
>
> 🔧 **v0.2.5** — 명시적 `models` 배열에서 범용 프로비저닝이 조용히 실패하던 문제 수정（dsh-settings path 연산은 배열 노드를 순회할 수 없음 → 배열째 교체 방식으로 변경）.
>
> 🔧 **v0.2.4** — pi-ai 설정 섹션의 늦은 등록으로 범용 프로비저닝이 반영되지 않던 문제 수정（준비될 때까지 재시도하는 방식으로 변경）.
>
> 🆕 **v0.2.3** — 모델 시트 트리거 버튼도 에포트 이름을 단계 색으로 표시하며, 메뉴를 닫은 후에도 유지.
>
> 🔧 **v0.2.2** — 메뉴 전체 리마운트 시 메뉴 행 색칠이 깨지던 문제 수정（전체 스캔 스로틀 리페인트, 에포트 텍스트에서 색 추론）.
>
> 🆕 **v0.2.1** — 패널을 닫은 후 모델 메뉴의 Effort 행 단계 값이 단계 색을 유지.
>
> ✨ **v0.2.0** — 커스텀 서드파티 모델/프로바이더에서도 추론 에포트 제어가 실제 작동（핫 적용）.
>
> 🎛️ **v0.1.0** — 초기 릴리스: 공식 Effort 메뉴를 인터셉트해 Claude Code 스타일 Effort 슬라이더 패널 표시.
>
> 버전별 상세: [Releases](https://github.com/2768651338/dsh-effort-slider/releases)

---

## 기능

| 기능 | 설명 |
| --- | --- |
| 🎚️ 무단 드래그 | 0–100을 연속으로 드래그하며 `reasoningEffort`를 실시간 기록（16ms 스로틀, 드래그 중 요청 적체 없음） |
| 🎯 손을 떼면 스냅 | 놓기/포커스 이탈/키보드 조작 종료 시 가장 가까운 단계로 스냅하고 확인 기록을 한 번 더 전송 |
| 🔥 WebGL 불꽃 꼬리 | 3패스 셰이더（점화 → 흐림 → 합성）. 불꽃 앞단은 스프링 감쇠로 썸을 따라감 |
| 🏁 OFF/MAX 눈금 | 첫/마지막 단계는 항상 `OFF` / `MAX`를 표시하고 중간 단계는 API가 반환한 이름 표시 |
| 🎨 단계 표시 | 단계 이름이 패널 헤더에 실시간 표시되며 단계에 따라 색/글로우가 변함. 패널을 닫은 후 메뉴 행과 모델 시트 트리거도 같은 색 유지（v0.2.3） |
| 🌐 범용 에포트 | `reasoning` 메타데이터가 없는 서드파티 모델에 범용 5단계 눈금을 자동 부여. pi-ai 모델은 와이어 수준 사전을 자동 보완, **핫 적용**（v0.2.0） |

기록하는 것은 `reasoningEffort`뿐이며 모델 선택은 건드리지 않습니다. 다단 추론이 없는 모델은 「当前模型不提供多档推理等级」（다단 추론 단계 없음）을 표시합니다.

### 범용 에포트 프로비저닝（v0.2.0, v0.3.0에서 단순화）

**커스텀 서드파티 모델/프로바이더에서도 추론 에포트 제어가 와이어에서 실제로 작동합니다**:

- **와이어 수준 프로비저닝（호스트, pi-ai）**: `llm-pi-ai` 설정에서 `reasoningEfforts`가 없는 커스텀 모델에 사전과 `compat` 와이어 다이얼렉트를 자동 보완（**핫 적용, 재시작 불필요**）. pi-ai가 단계를 실제 와이어 필드（`reasoning_effort` / `thinking` / OpenRouter의 `reasoning.effort` 등）로 번역하고, **같은 선언을 모델의 `reasoning` 카탈로그 메타데이터로도 노출**합니다 — 손으로 선언한 모델에 공식 **Effort** 행이 나타나는 근거가 바로 이것입니다;
- **클라이언트 폴백 눈금**: 디렉터리가 reasoning 메타데이터를 반환하지 않아도 패널은 범용 5단계 눈금으로 열립니다;
- 사용자의 기존 선언（`reasoningEfforts: false` 또는 커스텀 사전）은 항상 존중되며 덮어쓰지 않습니다.

> **어댑터 래퍼가 사라진 이유.** v0.2.5까지 호스트 측은 각 어댑터의 `resolveModel`을 감싸 `reasoning` 메타데이터를 선언하지 않은 모델에 `universalReasoning`을 주입했습니다. DSH 0.1.5에서 `llm.adapters`가 공개 접근자 없는 비공개 필드가 되어 이 경로는 불가능해졌고 — 더 이상 필요하지도 않습니다. `reasoningEfforts`는 「요청 와이어」와 「모델 카탈로그」 양쪽 모두에 먹히는 유일한 선언이기 때문입니다. 모델 수준 `compat`는 라우트가 `api: openai-completions`를 선언한 경우에만 기록합니다. pi-ai는 「해당 모델 프로토콜이 읽을 수 없는 스위치」를 거부하기 때문입니다.

커스텀 엔드포인트에서 지원하는 와이어 다이얼렉트（`effort-slider.defaultDialect` 또는 `routes.<route>`로 설정）:

| 다이얼렉트 | 와이어 효과 |
| --- | --- |
| `effort`（기본） | OpenAI 스타일 `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}` 토글 + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }`（OpenRouter 정규화） |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + 선택적 effort |
| `qwen` | `enable_thinking` 토글 |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort` 문자열 |

## 호환성

| 항목 | 값 |
| --- | --- |
| DSH 버전 | **0.1.5-rc.1**（npm `latest` dist-tag, 이 빌드가 검증한 버전）, Windows의 web 프로필 |
| 미지원 | DSH ≤ 0.1.1 — v0.2.5 이하는 `@deepseek-ai/dsh-client-runtime`을 import하며 이 패키지는 0.1.1-rc.2 이후 제거됨 |
| 설치 방식 | `dsh plugin --profile web add`（번들 패치 + 호스트/브라우저 더블 하프） |
| 의존 | `ctx.sessions`（`@deepseek-ai/dsh-api-session-controller`）와 `ctx.modelDirectories`（`@deepseek-ai/dsh-client-ui-model-selection`）. 호스트: `ctx.llm`, `ctx.settings` |
| 클라이언트 모듈 요청 | 플랫폼 기반（`react` / `react-dom/client` / `react/jsx-runtime`） 외 없음 — DSH import은 전부 타입 전용이며 번들 시 소거됨 |

## 설치 / 제거

```sh
# GitHub에서 설치（lib/ 빌드 산출물이 커밋되어 있어 로컬 빌드 불필요）
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# 또는 로컬 빌드 후 체크아웃에서 설치
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> 설치 후 **DeepSeek Harness를 재시작**하고 웹 페이지에서 **Ctrl+F5**를 한 번 누르세요.
> `lib/` 산출물이 커밋되어 있어 GitHub 설치에는 로컬 빌드가 필요 없습니다.

**오래된 DSH에 고정된 버전에서 업그레이드하는 경우?** `~/.dsh/profiles/web/cordis.patch.yml`에서 `- id: ui-effort-slider` / `disabled: true` 행을 삭제하세요. 그렇지 않으면 새 빌드가 꺼진 상태로 유지됩니다.

| 작업 | 명령 |
| --- | --- |
| 업그레이드 | `dsh plugin --profile web update dsh-effort-slider`（또는 add 재실행）, 이후 DSH 재시작 |
| 제거 | `dsh plugin --profile web remove dsh-effort-slider`, `cordis.patch.yml`에 행이 있으면 함께 제거 |

## 빠른 시작

1. 플러그인을 설치하고 DSH를 재시작한 뒤 `Ctrl+F5`를 누릅니다.
2. 컴포저 위의 모델 메뉴（루트 메뉴 두 번째 행）→ **Effort** 클릭 → Effort 슬라이더 패널이 나타납니다.
3. 드래그로 단계를 고르고 손을 떼면 자동 스냅. 패널을 닫은 후에도 모델 메뉴의 단계 값이 단계 색을 유지합니다.
4. 사고 에포트가 없는 커스텀 모델은 패널이 범용 5단계로 열리고, pi-ai 모델은 호스트 측에서 와이어 사전을 자동 보완합니다（핫 적용）.

DevTools Console에 `[effort-slider] intercept row: ...`가 보이면 인터셉트 성공입니다.

## 설정

| 항목 | 내용 |
| --- | --- |
| 플러그인 옵션 | `effort-slider` 설정 섹션（`~/.dsh/settings.yaml`에 기록, 핫 적용） |
| 기본값 | `enabled: true`, `defaultDialect: effort` |
| 환경 변수 | 자체 변수 없음 — DSH의 `DSH_HOME` 해석을 따름 |
| 민감 항목 | 없음 — 키/토큰/자격 증명을 읽거나 저장하지 않음 |

```yaml
effort-slider:
  enabled: true          # 프로비저닝 마스터 스위치
  defaultDialect: effort # 전역 기본 와이어 다이얼렉트
  routes:
    my-gateway: deepseek # 라우트별 재정의
```

## 권한과 데이터

| 범위 | 내용 |
| --- | --- |
| 파일（읽기） | 없음 — 사용자 파일을 읽거나 쓰지 않음（설정은 DSH settings 서비스 경유） |
| 네트워크 | 자체 요청 없음 — 패널은 브라우저 내 Model Controller 공유 디렉터리를 읽고 쓰며, 최종 `session.selectModel` 호출은 DSH 기존 연결을 태움 |
| 자격 증명 | 절대 읽지 않음 |
| 사용자 데이터 | 읽지 않음（대화 내용/메시지/프롬프트에 접근 없음. 공유 모델 디렉터리로 현재 세션의 provider/model/`reasoningEffort`만 다룸） |

## 동작 방식

| 측 | 파일 | 역할 |
| --- | --- | --- |
| 호스트 | `lib/index.js` | 범용 에포트 프로비저닝: pi-ai 와이어 패치（`buildProvisionOps`, 멱등, 사용자 선언 존중） + `settings.installSection`으로 설치되는 `effort-slider` 설정 섹션. `llm/adapters-updated` / `settings/updated`를 구독해 핫 적용 |
| 브라우저 | `lib/client.js` | 모델 메뉴의 Effort 행 클릭을 캡처 → Effort 패널 표시. `ctx.modelDirectories.directoryFor(sessionId)`로 읽고 `directory.select({ reasoningEffort })`로 기록. 패널이 닫힌 후엔 MutationObserver가 메뉴 행 단계 색을 지킴 |

> 브라우저 측은 공식 외부 플러그인 관례를 따릅니다: 클래식 스크립트 + `window.__ModuleLoader__.load` 팩토리. `react` / `react-dom/client` / `react/jsx-runtime`은 플랫폼 externals. `effort.module.css`는 lightningcss가 클래스명을 해싱해 인라인하고, 팩토리 실행 시 `<style data-plugin>`으로 주입합니다.

## 문제 해결

| 증상 | 해결 |
| --- | --- |
| 모델 메뉴에 Effort 행이 없음 | 모델이 reasoning 메타데이터를 선언하지 않았고 호스트 프로비저닝도 작동하지 않음 — DSH 재시작을 확인하고 `~/.dsh/settings.yaml`의 `effort-slider.enabled` 확인 |
| 패널에 「当前模型不支持思考强度调节」표시 | 범용 폴백 미작동 — v0.2.0+로 업그레이드 후 재시작 |
| 플러그인이 아예 로드되지 않음（행이 `disabled: true`） | 이전 빌드가 `~/.dsh/profiles/web/cordis.patch.yml`에서 꺼져 있었음. 해당 행 삭제 후 재시작 |
| 드래그해도 효과 없음 | 대상 엔드포인트의 와이어 다이얼렉트가 맞는지 확인（다이얼렉트 표 참조）하거나 해당 라우트에 `defaultDialect` 명시 |
| 다른 스킨 플러그인과 충돌 | Effort 행을 인터셉트하는 스킨（dsh-ui-web 계열 aurora 등）이 함께 설치된 경우 그 인터셉트를 꺼서 이중 패널 방지 |
| 재시작 후에도 버전이 옛날 | `file:` 설치는 스냅샷 복사본 — `github:`으로 설치하거나 add 재실행 후 재시작 |
| 로그는 어디에? | 호스트 오류: DSH 시작 로그. 클라이언트 오류: 브라우저 DevTools（F12） Console（`[effort-slider]` 접두사） |

## 프로젝트 구조

```text
src/
  index.ts                  호스트 측: pi-ai 와이어 프로비저닝 + 설정 섹션
  effort-core.ts             순수 로직: 다이얼렉트 → 와이어 매핑, 프로비저닝 패치 생성（단위 테스트됨）
  client/
    index.ts                브라우저 측: 모델 메뉴 Effort 행 인터셉트 + 패널 앵커 + 메뉴 행 색칠
    css-modules.d.ts
    effort/
      directory.ts          ctx.modelDirectories / ctx.sessions의 구조면（순수 타입, DSH 런타임 import 없음）
      EffortPanel.tsx       Effort 패널（단계/눈금/슬라이더/글로우）
      useWebglFire.ts       WebGL2 3패스 불꽃 루프（스프링 추종 + 유휴 절전）
      shaders.ts            버텍스/점화/흐림/합성 셰이더
      effortColors.ts       단계 → 색 매핑（패널과 메뉴 행이 공유）
      effort.module.css     패널 스타일（lightningcss 인라인 주입）
cordis.patch.yml           번들 패치（ui-effort-slider 행 삽입）
lib/                       빌드 산출물（client.js에 소스맵 포함）
test/                      host.spec.mjs 호스트 단위 + host-apply.spec.mjs + client.smoke.mjs
```

## 개발

```sh
pnpm install
pnpm build       # tsdown → lib/index.js（호스트 측） + lib/client.js（브라우저 측）
pnpm typecheck   # tsc --noEmit（@deepseek-ai/* 0.1.5-rc.1 기준 그린）
pnpm test        # 호스트 단위 + apply 통합 + 실제 이음세 통합 + jsdom 스모크
```

`test/` 4계층, 저렴한 순서:

| 파일 | 커버 범위 |
| --- | --- |
| `host.spec.mjs` | 순수 로직: 다이얼렉트 → 와이어 매핑, 프로비저닝 패치 생성, 멱등성 |
| `host-apply.spec.mjs` | mock cordis 컨텍스트에서의 `apply()`: pi-ai 설정 섹션 지연 등록 재시도, 선언된 프로토콜에 따른 `compat` 게이팅 |
| `host-integration.spec.mjs` | **실제 이음세**: 실제 `@deepseek-ai/cordis` + 실제 `@deepseek-ai/dsh-settings-file` 프로바이더 — `installSection` 등록, 실제 path-op 기록, 기록된 `reasoningEfforts`/`compat`가 pi-ai 검증 규칙 통과 |
| `client.smoke.mjs` | jsdom: 번들 팩토리 실체화, Effort 행 인터셉트, 패널 렌더, `directory.select` 경유 드래그/스냅 기록, 색칠, 언마운트 회수 |

**기여.** Fork → 수정 → `pnpm build` → `pnpm test` 실행 → `main`으로 PR. 사소한 수정（문서, 테스트）은 사전 협의 없이 환영합니다. 이슈에는 DSH 버전과 구체적 오류를 첨부하세요.

## 라이선스와 보안

**라이선스**: BSD-3-Clause — [LICENSE](../../LICENSE) 참조.
UI 구현은 커뮤니티 dsh-ui-web 프로젝트의 aurora 스킨（BSD-3-Clause）을 참고했으며, 전체 상위 고지와 라이선스 전문은
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)에 있습니다.

**보안**: 이 플러그인은 자격 증명을 읽지 않고 네트워크로 데이터를 보내지 않습니다（로컬 DSH와만 통신）. 보안 문제는 GitHub Security 탭의 **Report a vulnerability**로 비공개 보고해 주세요. 익스플로잇 세부사항을 공개 이슈에 올리지 마세요.

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
