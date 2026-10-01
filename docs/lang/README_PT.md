<!-- Versão em português. English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · [中文](README_ZH.md) · [Español](README_ES.md) · [日本語](README_JA.md) · [Deutsch](README_DE.md) · [Русский](README_RU.md) · **Português** · [한국어](README_KO.md)

</div>

> ※ Este documento é uma tradução do [original em inglês](../../README.md); em caso de divergência, prevalece a versão em inglês. Correções via Issue / PR são bem-vindas.

<div align="center">

# dsh-effort-slider

> **Um deslizador de nível de raciocínio estilo Claude Code para DeepSeek Harness** — clique em **Effort** no menu de modelos, arraste sem degraus, solte e ajusta, com um rastro de fogo em WebGL; qualquer modelo/provedor de terceiros ganha controle de esforço de raciocínio real e funcional.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

Clique na linha **Effort** (segunda linha do menu de modelos oficial) em vez da lista de níveis embutida: um **painel deslizante de Effort** se abre — marcas OFF/MAX, status Low/Medium/High/Ultracode em tempo real e, após fechar o painel, o valor de esforço permanece colorido na linha do menu e no botão-gatilho do assento de modelo.

[Funcionalidades](#funcionalidades) · [Compatibilidade](#compatibilidade) · [Instalação / Desinstalação](#instalação--desinstalação) · [Início rápido](#início-rápido) · [Configuração](#configuração) · [Permissões e dados](#permissões-e-dados) · [Como funciona](#como-funciona) · [Solução de problemas](#solução-de-problemas) · [Desenvolvimento](#desenvolvimento)

**Capturas de demonstração** (coloração da linha do menu / gatilho do assento de modelo / painel de Effort — nível colorido):

| Linha do menu | Gatilho do assento | Painel de Effort |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="Linha Effort do menu de modelos colorida" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="Gatilho do assento de modelo colorido" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Painel deslizante de Effort" width="240"> |

</div>

---

> 🆕 **v0.4.0** — Portado para o DSH **0.2.0**: o DSH substituiu seu serviço de settings por `SettingsForms` (as configurações agora são configs de profile entry; `installSection` / `settings.get` / `settings/updated` desapareceram). A metade host agora localiza a profile entry do pi-ai (`llm-pi-ai`), lê via `settings.describe()`, grava via `settings.mutate()` e escuta `settings/document-updated`. A metade cliente deriva a sessão atual de `retainedBy.mainView` (`SessionListState.current` foi removido). As opções do plugin (`enabled` / `defaultDialect` / `routes`) vivem na configuração da entry do plugin, editáveis na página de configurações do DSH. DSH ≤ 0.1.5 não é mais suportado (use lá a v0.3.0).
>
> 🆕 **v0.3.0** — Portado para o DSH 0.1.5: o `Context` do cliente agora vem de `@deepseek-ai/cordis`, o estado por sessão é lido/gravado via `ctx.modelDirectories` e a seção de configurações é instalada via `settings.installSection()`; o wrapper de metadados de adaptadores, agora impossível, foi removido (ver «Provisão universal de esforço»). DSH ≤ 0.1.1 não é mais suportado.
>
> 🔧 **v0.2.5** — Corrigido o provisionamento universal que falhava em silêncio em arrays `models` explícitos (operações path do dsh-settings não atravessam nós de array — agora o array é substituído inteiro).
>
> 🔧 **v0.2.4** — Corrigido o provisionamento universal que nunca era aplicado quando a seção de configurações pi-ai se registra tarde (agora repete até a seção estar pronta).
>
> 🆕 **v0.2.3** — O botão-gatilho do assento de modelo também colore o nome do esforço por nível, persistente após fechar o menu.
>
> 🔧 **v0.2.2** — Corrigida a coloração da linha do menu que quebrava em remontagens completas do menu (repintura completa com throttle; cor inferida do texto do esforço).
>
> 🆕 **v0.2.1** — Após fechar o painel, o valor de esforço na linha Effort do menu de modelos mantém a cor do nível.
>
> ✨ **v0.2.0** — Qualquer modelo/provedor personalizado de terceiros ganha controle de esforço de raciocínio que funciona de verdade (aplicado a quente).
>
> 🎛️ **v0.1.0** — Lançamento inicial: intercepta o menu Effort oficial e mostra um painel deslizante de Effort estilo Claude Code.
>
> Notas completas de cada versão: [Releases](https://github.com/2768651338/dsh-effort-slider/releases)

---

## Funcionalidades

| Funcionalidade | Descrição |
| --- | --- |
| 🎚️ Arrasto contínuo | Arrasto contínuo de 0–100 que grava `reasoningEffort` em tempo real (throttle de 16 ms, sem acúmulo de requisições durante o arrasto) |
| 🎯 Ajuste ao soltar | Ao soltar / perder o foco / encerrar via teclado, ajusta ao nível mais próximo e envia uma gravação de confirmação |
| 🔥 Rastro de fogo WebGL | Shaders de três passadas (ignição → desfoque → composição); a frente do fogo segue o polegar com amortecimento de mola |
| 🏁 Marcas OFF/MAX | Primeiro e último níveis sempre mostram `OFF` / `MAX`; níveis intermediários mostram o nome retornado pela API |
| 🎨 Status do nível | O nome do esforço aparece no cabeçalho do painel, colorido/brilhante por nível; a linha do menu e o gatilho do assento de modelo mantêm a mesma cor ao fechar (v0.2.3) |
| 🌐 Esforço universal | Modelos de terceiros sem metadados `reasoning` ganham automaticamente a escala universal de 5 níveis; modelos pi-ai recebem os dicionários de protocolo corrigidos, **aplicado a quente** (v0.2.0) |

Só `reasoningEffort` é gravado — a seleção de modelo não é tocada. Modelos sem raciocínio multinível mostram 「当前模型不提供多档推理等级」 (o modelo atual não oferece vários níveis de raciocínio).

### Provisão universal de esforço (v0.2.0, simplificada na v0.3.0)

**Qualquer modelo/provedor personalizado de terceiros ganha controle de esforço de raciocínio que realmente funciona no protocolo**:

- **Provisionamento no nível do protocolo (host, pi-ai)**: para modelos `llm-pi-ai` sem `reasoningEfforts`, o dicionário e o dialeto de protocolo `compat` são corrigidos (**aplicado a quente, sem reinício**); o pi-ai traduz o nível em campos reais do protocolo (`reasoning_effort` / `thinking` / `reasoning.effort` do OpenRouter, etc.) **e** publica a mesma declaração como metadados `reasoning` do catálogo do modelo — é por isso que a linha oficial **Effort** aparece num modelo declarado à mão;
- **Escala de reserva no cliente**: se o diretório não retorna metadados de raciocínio, o painel ainda abre com a escala universal de 5 níveis;
- Declarações existentes do usuário (`reasoningEfforts: false` ou um dicionário personalizado) são sempre respeitadas e nunca sobrescritas.

> **Por que não há mais wrapper de adaptadores.** Até a v0.2.5, a metade host também embrulhava o `resolveModel` de cada adaptador para injetar `universalReasoning` em modelos que não declaravam metadados `reasoning`. O DSH 0.1.5 tornou `llm.adapters` um campo privado sem acessador público — esse caminho ficou impossível, e também desnecessário: `reasoningEfforts` é a única declaração que alimenta tanto a requisição real quanto o catálogo de modelos. O `compat` no nível do modelo só é gravado quando a rota declara `api: openai-completions`, porque o pi-ai recusa um interruptor que o protocolo do modelo não consegue ler.

Dialetos de protocolo suportados para endpoints personalizados (defina `effort-slider.defaultDialect` ou `routes.<rota>`):

| Dialeto | Efeito no protocolo |
| --- | --- |
| `effort` (padrão) | `reasoning_effort: low/medium/high/max` estilo OpenAI |
| `deepseek` | chave `thinking:{type}` + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }` (normalizado pelo OpenRouter) |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + esforço opcional |
| `qwen` | chave `enable_thinking` |
| `string-thinking` / `ant-ling` | strings `thinking` / `reasoning.effort` |

## Compatibilidade

| Item | Valor |
| --- | --- |
| Versão do DSH | **0.2.0-rc.2** (a dist-tag `latest` do npm; a versão contra a qual este build foi verificado), perfil web no Windows |
| Não funciona em | DSH ≤ 0.1.5 — a v0.4.0 mira o serviço de settings `SettingsForms` introduzido no 0.2.0 (use a v0.3.0 para o DSH 0.1.5; a v0.2.5 e anteriores também importam `@deepseek-ai/dsh-client-runtime`, removido após 0.1.1-rc.2) |
| Mecanismo de instalação | `dsh plugin --profile web add` (patch de bundle + dupla metade) |
| Depende de | `ctx.sessions` (`@deepseek-ai/dsh-api-session-controller`) e `ctx.modelDirectories` (`@deepseek-ai/dsh-client-ui-model-selection`); host: `ctx.llm`, `ctx.settings` (`SettingsForms`) |
| Requisições de módulos do cliente | nenhuma além da base da plataforma (`react`, `react-dom/client`, `react/jsx-runtime`) — todos os imports de DSH são apenas de tipos e são apagados no bundle |

## Instalação / Desinstalação

```sh
# Instalar do GitHub (os artefatos de lib/ estão commitados, sem build local necessário)
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# Ou construir localmente e instalar a partir de um checkout
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> Depois de instalar, **reinicie o DeepSeek Harness** e pressione **Ctrl+F5** uma vez na página web.
> Os artefatos de `lib/` estão commitados: instalações via GitHub não precisam de build local.

**Vem de uma versão presa a um DSH antigo?** Remova qualquer linha `- id: ui-effort-slider` / `disabled: true` de `~/.dsh/profiles/web/cordis.patch.yml`, senão o novo build continua desligado.

| Ação | Comando |
| --- | --- |
| Atualizar | `dsh plugin --profile web update dsh-effort-slider` (ou rodar `add` de novo), depois reiniciar o DSH |
| Desinstalar | `dsh plugin --profile web remove dsh-effort-slider` e remover sua linha do `cordis.patch.yml`, se houver |

## Início rápido

1. Instale o plugin, reinicie o DSH, pressione `Ctrl+F5`.
2. Abra o menu de modelos acima do composer → clique em **Effort** → o painel deslizante de Effort aparece.
3. Arraste para escolher um nível; ajusta ao soltar. Depois de fechar o painel, o valor de esforço mantém sua cor na linha do menu.
4. Para modelos personalizados sem esforço de raciocínio, o painel abre com a escala universal de 5 níveis; modelos pi-ai recebem os dicionários de protocolo corrigidos no host (aplicado a quente).

Uma linha `[effort-slider] intercept row: ...` no Console do DevTools significa que a interceptação funciona.

## Configuração

| Item | Detalhes |
| --- | --- |
| Opções do plugin | a configuração de profile entry do plugin (`enabled` / `defaultDialect` / `routes`), editável na página de configurações do DSH (formulário gerado automaticamente), aplicada ao remontar o plugin |
| Padrões | `enabled: true`, `defaultDialect: effort` |
| Variáveis de ambiente | nenhuma própria; segue a resolução de `DSH_HOME` do DSH |
| Itens sensíveis | nenhum — nenhuma chave, token ou credencial é lida ou armazenada |

```yaml
effort-slider:
  enabled: true          # interruptor mestre do provisionamento
  defaultDialect: effort # dialeto de protocolo padrão global
  routes:
    my-gateway: deepseek # sobrescrita por rota
```

## Permissões e dados

| Escopo | O que toca |
| --- | --- |
| Arquivos (leitura) | nenhum — nenhum arquivo de usuário é lido ou gravado (configurações vão pelo serviço de settings do DSH) |
| Rede | nenhuma própria — o painel lê e grava o diretório no navegador do Model Controller; a chamada resultante a `session.selectModel` anda na conexão existente do DSH |
| Credenciais | nunca lidas |
| Dados do usuário | não lidos (sem acesso ao conteúdo de conversas/mensagens/prompts; apenas provider/model/`reasoningEffort` da sessão atual pelo diretório de modelos compartilhado) |

## Como funciona

| Metade | Arquivo | Papel |
| --- | --- | --- |
| Host | `lib/index.js` | Provisionamento universal de esforço: localiza a profile entry do pi-ai (`llm-pi-ai`), lê via `settings.describe()`, corrige os dialetos de protocolo via `settings.mutate` (`buildProvisionOps`, idempotente, respeita declarações do usuário); escuta `llm/adapters-updated` / `settings/document-updated` |
| Navegador | `lib/client.js` | Captura cliques na linha Effort do menu de modelos → mostra o painel Effort; lê `ctx.modelDirectories.directoryFor(sessionId)` e grava via `directory.select({ reasoningEffort })`; um MutationObserver mantém viva a cor de nível da linha do menu após fechar o painel |

> A metade navegador segue a convenção oficial de plugins externos: script clássico + fábrica `window.__ModuleLoader__.load`; `react` / `react-dom/client` / `react/jsx-runtime` são externals de plataforma; `effort.module.css` é hasheado e inlineado pelo lightningcss, injetado como `<style data-plugin>` quando a fábrica roda.

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Não há linha Effort no menu de modelos | O modelo não declara metadados de raciocínio e o provisionamento do host não está ativo — confirme que o DSH foi reiniciado e verifique `enabled` na página de configurações do plugin (sua configuração de profile entry) |
| O painel mostra 「当前模型不支持思考强度调节」 | O fallback universal não está ativo — atualize para v0.2.0+ e reinicie |
| O plugin não carrega de jeito nenhum (linha com `disabled: true`) | Um build antigo foi desligado em `~/.dsh/profiles/web/cordis.patch.yml`; apague essa linha e reinicie |
| Arrastar não tem efeito | Verifique se o dialeto de protocolo do endpoint alvo corresponde (veja a tabela de dialetos) ou defina `defaultDialect` para a rota |
| Conflitos com outros plugins de skin | Se outra skin que intercepta a linha Effort estiver instalada (ex.: a skin aurora do dsh-ui-web), desative a interceptação dela para evitar painéis duplicados |
| A versão continua antiga depois de reiniciar | Instalações `file:` são cópias de snapshot — use a especificação `github:` ou rode `add` de novo antes de reiniciar |
| Onde estão os logs? | Erros do host: log de inicialização do DSH; erros do cliente: Console do DevTools do navegador (F12) (prefixo `[effort-slider]`) |

## Estrutura do projeto

```text
src/
  index.ts                  metade host: provisionamento de protocolo pi-ai via a costura do SettingsForms
  effort-core.ts             lógica pura: mapeamento dialeto → protocolo, geração de patches de provisionamento (testada)
  client/
    index.ts                metade navegador: interceptação da linha Effort + âncora do painel + coloração da linha do menu
    css-modules.d.ts
    effort/
      directory.ts          face estrutural de ctx.modelDirectories / ctx.sessions (só tipos, sem import do runtime do DSH)
      EffortPanel.tsx       Painel Effort (níveis / marcas / deslizador / brilho)
      useWebglFire.ts       Loop de fogo WebGL2 de três passadas (seguimento por mola + sono em ociosidade)
      shaders.ts            shaders de vértice / ignição / desfoque / composição
      effortColors.ts       mapeamento nível → cor (compartilhado por painel e linha do menu)
      effort.module.css     estilos do painel (inline via lightningcss)
cordis.patch.yml           patch de bundle (insere a linha ui-effort-slider)
lib/                       artefatos de build (client.js com sourcemap)
test/                      testes unitários host.spec.mjs + host-apply.spec.mjs + client.smoke.mjs
```

## Desenvolvimento

```sh
pnpm install
pnpm build       # tsdown → lib/index.js (metade host) + lib/client.js (metade navegador)
pnpm typecheck   # tsc --noEmit (verde contra @deepseek-ai/* 0.2.0-rc.2)
pnpm test        # unitários do host + integração apply + integração de costura real + smoke jsdom
```

Camadas de `test/`, da mais barata para a mais cara:

| Arquivo | Escopo |
| --- | --- |
| `host.spec.mjs` | Lógica pura: mapeamento dialeto → protocolo, geração de patches de provisionamento, idempotência |
| `host-apply.spec.mjs` | `apply()` contra um contexto cordis mockado: retry por registro tardio da entry do pi-ai, gating de `compat` pelo protocolo declarado, idempotência de `settings/document-updated` |
| `host-integration.spec.mjs` | **Costura real**: `@deepseek-ai/cordis` real + um double fiel da costura `SettingsForms` (os pacotes npm do 0.2.0 não têm provedor independente) — descoberta da entry, gravações path-op reais pousando na configuração de profile entry, e o `reasoningEfforts`/`compat` gravado passando nas regras de validação do pi-ai |
| `client.smoke.mjs` | jsdom: materialização da fábrica do bundle, interceptação da linha Effort, render do painel, gravações de arraste/ajuste via `directory.select`, coloração, limpeza no unmount |

**Contribuir.** Fork → mudar → `pnpm build` → rodar `pnpm test` → abrir um PR contra `main`. Correções pequenas (docs, testes) são bem-vindas sem discussão prévia; reporte issues com a versão do DSH e o erro exato.

## Licença e segurança

**Licença**: BSD-3-Clause — veja [LICENSE](../../LICENSE).
A implementação da UI referencia a skin aurora do projeto comunitário dsh-ui-web (BSD-3-Clause); avisos completos de origem e textos de licença em
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

**Segurança**: este plugin não lê credenciais e não envia nada pela rede (fala apenas com o DSH local). Para reportar um problema de segurança em privado, use **Report a vulnerability** na aba Security do GitHub — não abra uma issue pública com detalhes de exploração.

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
