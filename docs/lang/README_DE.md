<!-- Deutsche Version. English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · [中文](README_ZH.md) · [Español](README_ES.md) · [日本語](README_JA.md) · **Deutsch** · [Русский](README_RU.md) · [Português](README_PT.md) · [한국어](README_KO.md)

</div>

> ※ Dieses Dokument ist eine Übersetzung des [englischen Originals](../../README.md); bei Abweichungen gilt die englische Fassung. Korrekturen per Issue / PR sind willkommen.

<div align="center">

# dsh-effort-slider

> **Ein Reasoning-Effort-Schieberegler im Claude-Code-Stil für DeepSeek Harness** — klicke im Modellmenü auf **Effort**, ziehe stufenlos, lass los und er rastet ein, mit einer WebGL-Feuerschweif; jedes Drittanbieter-Modell bzw. jeder Anbieter bekommt eine echte, funktionierende Thinking-Effort-Steuerung.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.5.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

Klicke auf die **Effort**-Zeile (zweite Zeile des offiziellen Modellmenüs) statt auf die eingebaute Stufenliste: ein **Effort-Schieberegler-Panel** poppt auf — OFF/MAX-Skalenmarken, Low/Medium/High/Ultracode-Status live, und nach dem Schließen bleibt der Effort-Wert auf der Menüzeile und auf dem Trigger-Button des Modell-Seats farbig.

[Funktionen](#funktionen) · [Kompatibilität](#kompatibilität) · [Installation / Deinstallation](#installation--deinstallation) · [Schnellstart](#schnellstart) · [Konfiguration](#konfiguration) · [Berechtigungen & Daten](#berechtigungen--daten) · [Funktionsweise](#funktionsweise) · [Fehlerbehebung](#fehlerbehebung) · [Entwicklung](#entwicklung)

**Demo-Screenshots** (Menüzeilen-Färbung / Modell-Seat-Trigger / Effort-Panel — Stufe farbig):

| Menüzeile | Modell-Seat-Trigger | Effort-Panel |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="Effort-Zeile im Modellmenü farbig" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="Modell-Seat-Trigger farbig" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Effort-Schieberegler-Panel" width="240"> |

</div>

---

> 🆕 **v0.5.0** — Evaluierungs-Fix-Batch. Zuverlässigkeit: das Panel unterscheidet jetzt „Lädt / Laden fehlgeschlagen / nicht unterstützt“ mit Retry-Button; fehlgeschlagene Slider-Schreibvorgänge zeigen kurz einen roten Status statt still zu scheitern; gleichzeitige Bearbeitungen der Nutzerkonfiguration werden erkannt (der Entry wird vor `mutate` neu gelesen, kollidierende Runden weichen aus); jeder Fehlerpfad der Host-Bereitstellung protokolliert jetzt eine Warnung, und eine nie erkannte Effort-Zeile erzeugt eine einmalige Diagnose. Panel-UX: verankert sich bei Scroll/Resize neu, schließt bei Esc / Klick außerhalb / Unmount des Ankers, ein erneuter Klick auf die Effort-Zeile schaltet sie um; Skalenpunkte und Labels liegen an den echten Einrastpunkten; der Slider trägt `aria-label` / `aria-valuetext`; die UI-Texte sind zweisprachig (zh/en, folgt `<html lang>`). Neue Option `debugReport`: Bereitstellungsdetails pro Route/Modell plus ein optionaler nur-lesender `llm/stream`-Tracer, der pro Anfrage Route/Modell/Effort protokolliert; ein `?`-Hinweis im Panel-Header zeigt auf `enabled` / Dialekt / `debugReport`. Außerdem: GitHub-Actions-CI (Typecheck + Tests + Build + Frischheits-Gate), die WebGL-Flamme brennt nicht mehr mit 60 fps, solange sie unsichtbar ist, und das npm-Paket heißt jetzt `@txc2768651338/dsh-effort-slider` (der alte Name ohne Scope, `dsh-effort-slider`, wurde eingestellt).
>
> 🆕 **v0.4.0** — Portiert auf DSH **0.2.0**: DSH hat seinen Settings-Dienst durch `SettingsForms` ersetzt (Einstellungen sind jetzt Profile-Entry-Konfigurationen; `installSection` / `settings.get` / `settings/updated` sind weg). Die Host-Hälfte lokalisiert jetzt den pi-ai-Profile-Entry (`llm-pi-ai`), liest ihn via `settings.describe()`, schreibt via `settings.mutate()` und hört auf `settings/document-updated`. Die Browser-Hälfte leitet die aktuelle Sitzung aus `retainedBy.mainView` ab (`SessionListState.current` wurde entfernt). Die Plugin-Optionen (`enabled` / `defaultDialect` / `routes`) liegen in der Entry-Konfiguration des Plugins und lassen sich auf der DSH-Settings-Seite bearbeiten. DSH ≤ 0.1.5 wird nicht mehr unterstützt (dort v0.3.0 verwenden).
>
> 🆕 **v0.3.0** — Portiert auf DSH 0.1.5: der Client-`Context` kommt jetzt aus `@deepseek-ai/cordis`, der Sitzungszustand wird über `ctx.modelDirectories` gelesen/geschrieben und die Settings-Sektion via `settings.installSection()` installiert; der Adapter-Metadaten-Wrapper wurde gestrichen (siehe „Universale Effort-Bereitstellung“). DSH ≤ 0.1.1 wird nicht mehr unterstützt.
>
> 🔧 **v0.2.5** — Behoben: universelles Provisioning schlug bei expliziten `models`-Arrays still fehl (dsh-settings-Pfad-Operationen können Array-Knoten nicht durchqueren — das Array wird jetzt als Ganzes ersetzt).
>
> 🔧 **v0.2.4** — Behoben: universelles Provisioning landete nie, wenn sich die pi-ai-Settings-Sektion spät registrierte (jetzt Retry, bis die Sektion bereit ist).
>
> 🆕 **v0.2.3** — Auch der Trigger-Button am Modell-Seat färbt seinen Effort-Namen stufengerecht, dauerhaft nach dem Schließen des Menüs.
>
> 🔧 **v0.2.2** — Behoben: die Menüzeilen-Färbung brach bei kompletten Menü-Remounts (vollständiger, gedrosselter Repaint; Farbe aus dem Effort-Text abgeleitet).
>
> 🆕 **v0.2.1** — Nach dem Schließen behält der Effort-Wert in der Effort-Zeile des Modellmenüs seine Stufenfarbe.
>
> ✨ **v0.2.0** — Jedes benutzerdefinierte Drittanbieter-Modell bzw. jeder Anbieter bekommt funktionierende Thinking-Effort-Steuerung (Hot-Apply).
>
> 🎛️ **v0.1.0** — Erste Veröffentlichung: fängt das offizielle Effort-Menü ab und zeigt ein Effort-Schieberegler-Panel im Claude-Code-Stil.
>
> Vollständige Notizen zu jeder Version: [Releases](https://github.com/2768651338/dsh-effort-slider/releases)

---

## Funktionen

| Funktion | Beschreibung |
| --- | --- |
| 🎚️ Stufenloses Ziehen | Kontinuierliches Ziehen von 0–100, das `reasoningEffort` in Echtzeit schreibt (16-ms-Drossel, kein Stau von Anfragen beim Ziehen) |
| 🎯 Einrasten beim Loslassen | Rastet beim Loslassen / Fokusverlust / Ende der Tastatureingabe auf die nächste Stufe ein, mit einer Bestätigungsschreibung |
| 🔥 WebGL-Feuerschweif | Drei-Pass-Shader (Zünden → Weichzeichnen → Komposition); die Feuerfront folgt dem Daumen mit Federdämpfung |
| 🏁 OFF/MAX-Marken | Erste und letzte Stufe zeigen immer `OFF` / `MAX`; mittlere Stufen zeigen den von der API zurückgegebenen Namen |
| 🎨 Stufenstatus | Der Effort-Name steht live im Panel-Kopf, farbig/leuchtend je nach Stufe; Menüzeile und Modell-Seat-Trigger behalten die Farbe nach dem Schließen (v0.2.3) |
| 🌐 Universeller Effort | Drittanbieter-Modelle ohne `reasoning`-Metadaten erhalten automatisch die universelle 5-Stufen-Skala; pi-ai-Modelle bekommen ihre Wire-Wörterbücher eingepatcht, **per Hot-Apply** (v0.2.0) |

Geschrieben wird nur `reasoningEffort` — die Modellauswahl bleibt unberührt. Modelle ohne mehrstufiges Reasoning zeigen 「当前模型不提供多档推理等级」 (kein mehrstufiges Reasoning verfügbar).

### Universale Effort-Bereitstellung (v0.2.0, in v0.3.0 vereinfacht)

**Jedes benutzerdefinierte Drittanbieter-Modell bzw. jeder Anbieter erhält eine Thinking-Effort-Steuerung, die auf der Leitung wirklich funktioniert**:

- **Wire-Level-Bereitstellung (Host, pi-ai)**: für `llm-pi-ai`-Modelle ohne `reasoningEfforts` werden Wörterbuch und `compat`-Wire-Dialekt eingepatcht (**Hot-Apply, kein Neustart**); pi-ai übersetzt die Stufe in echte Wire-Felder (`reasoning_effort` / `thinking` / OpenRouter `reasoning.effort` usw.) **und** veröffentlicht dieselbe Deklaration als `reasoning`-Katalog-Metadaten des Modells — genau deshalb erscheint bei handdeklarierten Modellen überhaupt die offizielle **Effort**-Zeile;
- **Client-Fallback-Skala**: liefert das Verzeichnis keine Reasoning-Metadaten, öffnet das Panel trotzdem mit der universellen 5-Stufen-Skala;
- Vorhandene Nutzerdeklarationen (`reasoningEfforts: false` oder ein eigenes Wörterbuch) werden immer respektiert und nie überschrieben.

> **Warum es den Adapter-Wrapper nicht mehr gibt.** Bis v0.2.5 umwickelte die Host-Hälfte auch das `resolveModel` jedes Adapters, um Modellen ohne `reasoning`-Metadaten `universalReasoning` zu injizieren. DSH 0.1.5 machte `llm.adapters` zu einem privaten Feld ohne öffentlichen Accessor — dieser Weg ist damit unmöglich, und auch unnötig: `reasoningEfforts` ist die eine Deklaration, die sowohl den Request-Wire als auch den Modellkatalog speist. Modell-Level-`compat` wird nur geschrieben, wenn die Route `api: openai-completions` deklariert, weil pi-ai einen Schalter ablehnt, den das Protokoll des Modells nicht lesen kann.

Unterstützte Wire-Dialekte für eigene Endpunkte (setze `effort-slider.defaultDialect` oder `routes.<Route>`). Ein Dialekt
übersetzt Stufen nur auf `api: openai-completions`-Routen — native Protokolle nutzen pi-ais eingebaute Zuordnung, der
Dialekt hat dort also keine Draht-Wirkung:

| Dialekt | Wire-Effekt |
| --- | --- |
| `effort` (Standard) | OpenAI-Stil `reasoning_effort: low/medium/high/max` |
| `deepseek` | `thinking:{type}`-Schalter + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }` (OpenRouter-normalisiert) |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + optionaler Effort |
| `qwen` | `enable_thinking`-Schalter |
| `string-thinking` / `ant-ling` | `thinking` / `reasoning.effort`-Strings |

## Kompatibilität

| Punkt | Wert |
| --- | --- |
| DSH-Version | **0.2.0-rc.2** (der npm-`latest`-Dist-Tag; die Version, gegen die dieser Build verifiziert ist), Web-Profil unter Windows |
| Kaputt auf | DSH ≤ 0.1.5 — v0.4.0 zielt auf den in 0.2.0 eingeführten `SettingsForms`-Settings-Dienst (für DSH 0.1.5 v0.3.0 verwenden; v0.2.5 und früher importieren zusätzlich `@deepseek-ai/dsh-client-runtime`, das nach 0.1.1-rc.2 entfernt wurde) |
| Installationsmechanismus | `dsh plugin --profile web add` (Bundle-Patch + doppelte Hälfte) |
| Abhängigkeiten | `ctx.sessions` (`@deepseek-ai/dsh-api-session-controller`) und `ctx.modelDirectories` (`@deepseek-ai/dsh-client-ui-model-selection`); Host: `ctx.llm`, `ctx.settings` (`SettingsForms`) |
| Client-Modulanfragen | keine über die Plattformbasis hinaus (`react`, `react-dom/client`, `react/jsx-runtime`) — alle DSH-Imports sind reine Typimports und werden beim Bundling entfernt |

## Installation / Deinstallation

```sh
# Von npm installieren (das auf deepseek1024.com gelistete Paket)
dsh plugin --profile web add @txc2768651338/dsh-effort-slider

# Oder von GitHub installieren (die committeten lib/-Artefakte brauchen keinen lokalen Build)
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# Oder lokal bauen und aus einem Checkout installieren
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> Nach der Installation **DeepSeek Harness neu starten** und auf der Webseite einmal **Ctrl+F5** drücken.
> Die `lib/`-Artefakte sind committet, GitHub-Installationen brauchen keinen lokalen Build.

**Kommst du von einer Version, die an ein altes DSH gepinnt war?** Entferne jede Zeile `- id: ui-effort-slider` / `disabled: true` aus `~/.dsh/profiles/web/cordis.patch.yml`, sonst bleibt der neue Build ausgeschaltet.

| Aktion | Befehl |
| --- | --- |
| Upgrade | `dsh plugin --profile web update @txc2768651338/dsh-effort-slider` (oder `add` erneut ausführen), danach DSH neu starten |
| Deinstallation | `dsh plugin --profile web remove @txc2768651338/dsh-effort-slider`, danach seine Zeile aus `cordis.patch.yml` entfernen, falls vorhanden |

## Schnellstart

1. Plugin installieren, DSH neu starten, `Ctrl+F5` drücken.
2. Modellmenü über dem Composer öffnen → auf **Effort** klicken → das Effort-Schieberegler-Panel erscheint.
3. Ziehen, um eine Stufe zu wählen; beim Loslassen rastet sie ein. Nach dem Schließen behält der Effort-Wert seine Farbe auf der Menüzeile.
4. Bei benutzerdefinierten Modellen ohne Thinking-Effort öffnet sich das Panel mit der universellen 5-Stufen-Skala; pi-ai-Modelle bekommen ihre Wire-Wörterbücher hostseitig eingepatcht (Hot-Apply).

Eine Zeile `[effort-slider] intercept row: ...` in der DevTools-Konsole bedeutet, dass die Abfangung funktioniert.

## Konfiguration

| Punkt | Details |
| --- | --- |
| Plugin-Optionen | die Profile-Entry-Konfiguration des Plugins (`enabled` / `defaultDialect` / `routes` / `debugReport`), bearbeitbar auf der DSH-Settings-Seite (automatisch generiertes Formular), angewandt beim Plugin-Remount |
| Standardwerte | `enabled: true`, `defaultDialect: effort`, `debugReport: false` |
| Umgebungsvariablen | keine eigenen; folgt der `DSH_HOME`-Auflösung von DSH |
| Sensible Punkte | keine — es werden keine Schlüssel, Tokens oder Zugangsdaten gelesen oder gespeichert |

```yaml
effort-slider:
  enabled: true          # Master-Schalter fürs Provisioning
  defaultDialect: effort # globaler Standard-Wire-Dialekt
  routes:
    my-gateway: deepseek # Override pro Route
  debugReport: false     # Bereitstellungsbericht pro Durchlauf (Route/Modell/Dialekt/Schreiben-oder-Skip) + Aufwands-Trace pro Anfrage (llm/stream) im Host-Log
```

## Berechtigungen & Daten

| Bereich | Was es berührt |
| --- | --- |
| Dateien (Lesen) | keine — es werden keine Nutzerdateien gelesen oder geschrieben (Settings laufen über den Settings-Dienst von DSH) |
| Netzwerk | keine eigenen — das Panel liest und schreibt das In-Browser-Verzeichnis des Model Controllers; der resultierende `session.selectModel`-Aufruf reitet auf der bestehenden DSH-Verbindung |
| Zugangsdaten | werden nie gelesen |
| Nutzerdaten | werden nicht gelesen (kein Zugriff auf Unterhaltungsinhalte/Nachrichten/Prompts; nur provider/model/`reasoningEffort` der aktuellen Session über das gemeinsame Modellverzeichnis) |

## Funktionsweise

| Hälfte | Datei | Rolle |
| --- | --- | --- |
| Host | `lib/index.js` | Universale Effort-Bereitstellung: lokalisiert den pi-ai-Profile-Entry (`llm-pi-ai`), liest ihn via `settings.describe()`, patcht Wire-Dialekte via `settings.mutate` (`buildProvisionOps`, idempotent, respektiert Nutzerdeklarationen); hört auf `llm/adapters-updated` / `settings/document-updated`. Mit `debugReport: true` protokolliert jeder Durchlauf einen Bericht pro Route/Modell (geschriebene Felder oder Skip-Grund, mit Hinweis, wo der Dialekt nicht greift) statt der Einzeilenzählung, und jeder Modellaufruf wird als `[debug] request route=… model=… effort=…` über eine nur lesende `llm/stream`-Durchleitung verfolgt |
| Browser | `lib/client.js` | Fängt Klicks auf die Effort-Zeile des Modellmenüs ab → zeigt das Effort-Panel; liest `ctx.modelDirectories.directoryFor(sessionId)` und schreibt über `directory.select({ reasoningEffort })`; ein MutationObserver hält die Stufenfarbe der Menüzeile nach dem Schließen am Leben |

> Die Browser-Hälfte folgt der offiziellen Konvention für externe Plugins: klassisches Skript + `window.__ModuleLoader__.load`-Factory; `react` / `react-dom/client` / `react/jsx-runtime` sind Plattform-Externals; `effort.module.css` wird von lightningcss gehasht und inline eingebettet, injiziert als `<style data-plugin>`, wenn die Factory läuft.

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| Keine Effort-Zeile im Modellmenü | Das Modell deklariert keine Reasoning-Metadaten und das Host-Provisioning greift nicht — prüfe, ob DSH neu gestartet wurde, und prüfe `enabled` auf der Settings-Seite des Plugins (seine Profile-Entry-Konfiguration); setze `debugReport: true` und prüfe das Host-Log auf den Bereitstellungsbericht pro Modell |
| Panel sagt 「当前模型不支持思考强度调节」 | Universeller Fallback nicht aktiv — auf v0.2.0+ upgraden und neu starten |
| Plugin lädt gar nicht (Zeile zeigt `disabled: true`) | Ein früherer Build wurde in `~/.dsh/profiles/web/cordis.patch.yml` abgeschaltet; Zeile löschen und neu starten |
| Ziehen zeigt keine Wirkung | Prüfe, ob der Wire-Dialekt des Ziel-Endpunkts passt (siehe Dialekt-Tabelle — Dialekte übersetzen nur auf `api: openai-completions`-Routen), oder setze `defaultDialect` für diese Route. Mit `debugReport: true` deckt das Host-Log die gesamte prüfbare Kette ab: der Bericht pro Modell sagt genau, was geschrieben (oder übersprungen, und warum) wurde, und markiert Routen, auf denen der Dialekt nicht greift; die Zeilen `[debug] request route=… model=… effort=…` belegen, welche Stufe jeder Aufruf trägt. Es bleibt nur die Draht-Übersetzung in pi-ai, die kein Plugin beobachten kann. Der `?`-Button des Panels wiederholt diese Checkliste |
| Konflikte mit anderen Skin-Plugins | Ist ein weiterer Skin installiert, der die Effort-Zeile abfängt (z. B. der Aurora-Skin von dsh-ui-web), deaktiviere dessen Abfangen, um Doppelpanels zu vermeiden |
| Version zeigt nach Neustart noch die alte | `file:`-Installationen sind Snapshot-Kopien — die `github:`-Spec verwenden oder `add` erneut ausführen, dann neu starten |
| Wo sind die Logs? | Host-Fehler: DSH-Startlog (mit `debugReport: true` erscheinen Bereitstellungs-Details und Aufwands-Traces pro Anfrage als `effort-slider: [debug]`-Zeilen); Client-Fehler: Browser-DevTools (F12) Konsole (Präfix `[effort-slider]`) |

## Projektstruktur

```text
src/
  index.ts                  Host-Hälfte: pi-ai-Wire-Provisioning über die SettingsForms-Naht
  effort-core.ts             reine Logik: Dialekt → Wire-Mapping, Provisioning-Patch-Erzeugung (unit-getestet)
  client/
    index.ts                Browser-Hälfte: Abfangen der Effort-Zeile + Panel-Anker + Menüzeilen-Färbung
    css-modules.d.ts
    effort/
      directory.ts          strukturelle Fläche von ctx.modelDirectories / ctx.sessions (nur Typen, kein DSH-Runtime-Import)
      EffortPanel.tsx       Effort-Panel (Stufen / Marken / Regler / Glow)
      useWebglFire.ts       WebGL2-Drei-Pass-Feuerschleife (Feder-Follow + Idle-Schlaf)
      shaders.ts            Vertex- / Zünd- / Weichzeichnungs- / Kompositions-Shader
      effortColors.ts       Stufe → Farbmapping (Panel und Menüzeile teilen es)
      effort.module.css     Panel-Stile (inline via lightningcss)
cordis.patch.yml           Bundle-Patch (fügt die ui-effort-slider-Zeile ein)
lib/                       Build-Artefakte (client.js mit Sourcemap)
test/                      host.spec.mjs Unit-Tests + host-apply.spec.mjs + client.smoke.mjs
```

## Entwicklung

```sh
pnpm install
pnpm build       # tsdown → lib/index.js (Host-Hälfte) + lib/client.js (Browser-Hälfte)
pnpm typecheck   # tsc --noEmit (grün gegen @deepseek-ai/* 0.2.0-rc.2)
pnpm test        # Host-Unit-Tests + Apply-Integrationstest + echte-Naht-Integrationstest + jsdom-Smoke
```

`test/`-Schichten, vom billigsten zuerst:

| Datei | Umfang |
| --- | --- |
| `host.spec.mjs` | Reine Logik: Dialekt → Wire-Mapping, Provisioning-Patch-Erzeugung, Idempotenz |
| `host-apply.spec.mjs` | `apply()` gegen einen gemockten cordis-Kontext: Retry bei später Registrierung des pi-ai-Entrys, `compat`-Gating nach deklariertem Protokoll, `settings/document-updated`-Idempotenz |
| `host-integration.spec.mjs` | **Echte Naht**: echtes `@deepseek-ai/cordis` + ein getreues `SettingsForms`-Naht-Double (die npm-Pakete von 0.2.0 haben keinen eigenständigen Provider) — Entry-Auffindung, echte Path-Op-Schreibvorgänge, die in der Profile-Entry-Konfiguration landen, und das geschriebene `reasoningEfforts`/`compat` besteht pi-ais Validierungsregeln |
| `client.smoke.mjs` | jsdom: Materialisierung der Bundle-Factory, Abfangen der Effort-Zeile, Panel-Render, Drag/Snap-Schreibvorgänge über `directory.select`, Färbung, Aufräumen beim Unmount |

**Beitragen.** Fork → ändern → `pnpm build` → `pnpm test` ausführen → PR gegen `main` öffnen. Kleine Fixes (Doku, Tests) sind ohne vorherige Absprache willkommen; Issues mit DSH-Version und exakter Fehlermeldung melden.

## Lizenz & Sicherheit

**Lizenz**: BSD-3-Clause — siehe [LICENSE](../../LICENSE).
Die UI-Implementierung referenziert den Aurora-Skin des Community-Projekts dsh-ui-web (BSD-3-Clause); vollständige Upstream-Hinweise und Lizenztexte in
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

**Sicherheit**: dieses Plugin liest keine Zugangsdaten und sendet nichts über das Netzwerk (spricht nur mit dem lokalen DSH). Sicherheitsprobleme bitte privat melden über GitHubs **Report a vulnerability** im Security-Tab — keine öffentlichen Issues mit Exploit-Details.

## Star History

<div align="center">

<a href="https://star-history.com/#2768651338/dsh-effort-slider&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=2768651338/dsh-effort-slider&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=2768651338/dsh-effort-slider&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=2768651338/dsh-effort-slider&type=Date" />
  </picture>
</a>

</div>

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
