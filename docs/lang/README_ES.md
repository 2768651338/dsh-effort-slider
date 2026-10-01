<!-- Versión en español. English: [README](../../README.md) -->
<div align="center">

[**English**](../../README.md) · [中文](README_ZH.md) · **Español** · [日本語](README_JA.md) · [Deutsch](README_DE.md) · [Русский](README_RU.md) · [Português](README_PT.md) · [한국어](README_KO.md)

</div>

> ※ Este documento es una traducción del [original en inglés](../../README.md); en caso de discrepancia prevalece la versión inglesa. Las correcciones vía Issue / PR son bienvenidas.

<div align="center">

# dsh-effort-slider

> **Un deslizador de nivel de razonamiento estilo Claude Code para DeepSeek Harness** — haz clic en **Effort** en el menú de modelos, arrastra sin escalones, suelta y se ajusta, con una estela de fuego WebGL; cualquier modelo/proveedor de terceros obtiene un control real y funcional del esfuerzo de razonamiento.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-effort-slider/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)

<br>

Haz clic en la fila **Effort** (segunda fila del menú de modelos oficial) en lugar de la lista de niveles integrada: se despliega un **panel deslizante de Effort** — marcas OFF/MAX, estado Low/Medium/High/Ultracode en vivo y, tras cerrar el panel, el valor de esfuerzo permanece coloreado en la fila del menú y en el botón disparador del asiento de modelos.

[Características](#características) · [Compatibilidad](#compatibilidad) · [Instalación / Desinstalación](#instalación--desinstalación) · [Inicio rápido](#inicio-rápido) · [Configuración](#configuración) · [Permisos y datos](#permisos-y-datos) · [Cómo funciona](#cómo-funciona) · [Solución de problemas](#solución-de-problemas) · [Desarrollo](#desarrollo)

**Capturas de demostración** (coloreado de la fila del menú / disparador del asiento de modelos / panel de Effort — nivel coloreado):

| Fila del menú | Disparador del asiento | Panel de Effort |
| --- | --- | --- |
| <img src="../../assets/screenshots/屏幕截图 2026-08-16 190943.png" alt="Fila Effort del menú de modelos coloreada" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190950.png" alt="Disparador del asiento de modelos coloreado" width="240"> | <img src="../../assets/screenshots/屏幕截图 2026-08-16 190903.png" alt="Panel deslizante de Effort" width="240"> |

</div>

---

> 🆕 **v0.3.0** — Portado a DSH 0.1.5: el `Context` del cliente viene ahora de `@deepseek-ai/cordis`, el estado por sesión se lee/escribe vía `ctx.modelDirectories` y la sección de ajustes se instala vía `settings.installSection()`; el envoltorio de metadatos de adaptadores fue eliminado (ver «Ajuste universal de esfuerzo»). DSH ≤ 0.1.1 ya no es compatible.
>
> 🔧 **v0.2.5** — Corregido el fallo silencioso del aprovisionamiento universal con arrays `models` explícitos (las operaciones path de dsh-settings no pueden atravesar nodos de array — ahora el array se reemplaza como un todo).
>
> 🔧 **v0.2.4** — Corregido el aprovisionamiento universal que nunca aterrizaba cuando la sección de ajustes pi-ai se registra tarde (ahora reintenta hasta que la sección está lista).
>
> 🆕 **v0.2.3** — El botón disparador del asiento de modelos también colorea el nombre del esfuerzo según el nivel, persistente tras cerrar el menú.
>
> 🔧 **v0.2.2** — Corregido el coloreado de la fila del menú que se rompía al remontarse todo el árbol del menú (repintado completo con estrangulación; color inferido del texto del esfuerzo).
>
> 🆕 **v0.2.1** — Tras cerrar el panel, el valor de esfuerzo en la fila Effort del menú de modelos conserva el color del nivel.
>
> ✨ **v0.2.0** — Cualquier modelo/proveedor personalizado de terceros obtiene un control de esfuerzo de razonamiento que funciona de verdad (aplicado en caliente).
>
> 🎛️ **v0.1.0** — Lanzamiento inicial: intercepta el menú Effort oficial y muestra un panel deslizante de Effort estilo Claude Code.
>
> Notas completas de cada versión: [Releases](https://github.com/2768651338/dsh-effort-slider/releases)

---

## Características

| Característica | Descripción |
| --- | --- |
| 🎚️ Arrastre continuo | Arrastre 0–100 continuo que escribe `reasoningEffort` en tiempo real (estrangulación de 16 ms, sin acumulación de peticiones mientras arrastras) |
| 🎯 Ajuste al soltar | Al soltar / perder el foco / terminar con el teclado, se ajusta al nivel más cercano y envía una escritura de confirmación |
| 🔥 Estela de fuego WebGL | Shaders de tres pasadas (ignición → desenfoque → composición); el frente del fuego sigue el pulgar con amortiguación de resorte |
| 🏁 Marcas OFF/MAX | El primer y el último nivel muestran siempre `OFF` / `MAX`; los niveles intermedios muestran el nombre devuelto por la API |
| 🎨 Estado del nivel | El nombre del esfuerzo se muestra en la cabecera del panel, coloreado/brillante según el nivel; la fila del menú y el disparador del asiento de modelos conservan el mismo color al cerrar (v0.2.3) |
| 🌐 Esfuerzo universal | Los modelos de terceros sin metadatos `reasoning` obtienen automáticamente la escala universal de 5 niveles; los modelos pi-ai reciben los diccionarios a nivel de cable parcheados, **aplicado en caliente** (v0.2.0) |

Solo se escribe `reasoningEffort` — la selección de modelo no se toca. Los modelos sin razonamiento multinivel muestran 「当前模型不提供多档推理等级」 (el modelo actual no ofrece varios niveles de razonamiento).

### Ajuste universal de esfuerzo (v0.2.0, simplificado en v0.3.0)

**Cualquier modelo/proveedor personalizado de terceros obtiene un control del esfuerzo de razonamiento que de verdad funciona en el cable**:

- **Aprovisionamiento a nivel de cable (host, pi-ai)**: para los modelos `llm-pi-ai` sin `reasoningEfforts`, se parchean el diccionario y el dialecto de cable `compat` (**aplicado en caliente, sin reinicio**); pi-ai traduce el nivel a campos reales del cable (`reasoning_effort` / `thinking` / `reasoning.effort` de OpenRouter, etc.) **y** publica la misma declaración como metadatos `reasoning` del catálogo del modelo — gracias a eso aparece la fila oficial **Effort** en un modelo declarado a mano;
- **Escala de respaldo en el cliente**: si el directorio no devuelve metadatos de razonamiento, el panel se abre igualmente con la escala universal de 5 niveles;
- Las declaraciones existentes del usuario (`reasoningEfforts: false` o un diccionario personalizado) siempre se respetan y nunca se sobrescriben.

> **Por qué ya no hay envoltorio de adaptadores.** Hasta la v0.2.5, la parte host también envolvía el `resolveModel` de cada adaptador para inyectar `universalReasoning` en los modelos que no declaraban metadatos `reasoning`. DSH 0.1.5 convirtió `llm.adapters` en un campo privado sin accesor público, así que esa vía es imposible — y ya no es necesaria: `reasoningEfforts` es la única declaración que alimenta tanto la solicitud real como el catálogo de modelos. El `compat` a nivel de modelo solo se escribe cuando la ruta declara `api: openai-completions`, porque pi-ai rechaza un interruptor que el protocolo del modelo no puede leer.

Dialectos de cable admitidos para endpoints personalizados (configura `effort-slider.defaultDialect` o `routes.<ruta>`):

| Dialecto | Efecto en el cable |
| --- | --- |
| `effort` (predeterminado) | `reasoning_effort: low/medium/high/max` estilo OpenAI |
| `deepseek` | conmutador `thinking:{type}` + `reasoning_effort` |
| `openrouter` | `reasoning: { effort }` (normalizado por OpenRouter) |
| `together` / `zai` | `reasoning.enabled` / `thinking:{type}` + esfuerzo opcional |
| `qwen` | conmutador `enable_thinking` |
| `string-thinking` / `ant-ling` | cadenas `thinking` / `reasoning.effort` |

## Compatibilidad

| Elemento | Valor |
| --- | --- |
| Versión de DSH | **0.1.5-rc.1** (el dist-tag `latest` de npm; la versión contra la que se verificó esta compilación), perfil web en Windows |
| No funciona en | DSH ≤ 0.1.1 — la v0.2.5 y anteriores importan `@deepseek-ai/dsh-client-runtime`, eliminado tras 0.1.1-rc.2 |
| Mecanismo de instalación | `dsh plugin --profile web add` (parche de bundle + doble mitad) |
| Depende de | `ctx.sessions` (`@deepseek-ai/dsh-api-session-controller`) y `ctx.modelDirectories` (`@deepseek-ai/dsh-client-ui-model-selection`); host: `ctx.llm`, `ctx.settings` |
| Peticiones de módulos del cliente | ninguna más allá de la base de la plataforma (`react`, `react-dom/client`, `react/jsx-runtime`) — todos los import de DSH son solo de tipos y se eliminan al empaquetar |

## Instalación / Desinstalación

```sh
# Instalar desde GitHub (los artefactos de lib/ están comprometidos, no hace falta compilar)
dsh plugin --profile web add github:2768651338/dsh-effort-slider#main

# O compilar localmente e instalar desde un checkout
pnpm install && pnpm build
dsh plugin --profile web add file:./dsh-effort-slider
```

> Tras instalar, **reinicia DeepSeek Harness** y pulsa **Ctrl+F5** una vez en la página web.
> Los artefactos de `lib/` están comprometidos: las instalaciones desde GitHub no requieren compilación local.

**¿Vienes de una versión fijada a un DSH antiguo?** Elimina cualquier fila `- id: ui-effort-slider` / `disabled: true` de `~/.dsh/profiles/web/cordis.patch.yml`, o la nueva compilación seguirá desactivada.

| Acción | Comando |
| --- | --- |
| Actualizar | `dsh plugin --profile web update dsh-effort-slider` (o reejecutar `add`), luego reiniciar DSH |
| Desinstalar | `dsh plugin --profile web remove dsh-effort-slider`, y quitar su fila de `cordis.patch.yml` si la hay |

## Inicio rápido

1. Instala el plugin, reinicia DSH, pulsa `Ctrl+F5`.
2. Abre el menú de modelos sobre el composer → haz clic en **Effort** → aparece el panel deslizante de Effort.
3. Arrastra para elegir un nivel; se ajusta al soltar. Tras cerrar el panel, el valor de esfuerzo conserva su color en la fila del menú.
4. Para modelos personalizados sin esfuerzo de razonamiento, el panel se abre con la escala universal de 5 niveles; los modelos pi-ai reciben sus diccionarios de cable parcheados en el host (aplicado en caliente).

Una línea `[effort-slider] intercept row: ...` en la Consola de DevTools significa que la intercepción funciona.

## Configuración

| Elemento | Detalles |
| --- | --- |
| Opciones del plugin | sección de ajustes `effort-slider` (escrita en `~/.dsh/settings.yaml`, aplicada en caliente) |
| Valores por defecto | `enabled: true`, `defaultDialect: effort` |
| Variables de entorno | ninguna propia; sigue la resolución de `DSH_HOME` de DSH |
| Elementos sensibles | ninguno — no se leen ni almacenan claves, tokens ni credenciales |

```yaml
effort-slider:
  enabled: true          # interruptor maestro del aprovisionamiento
  defaultDialect: effort # dialecto de cable por defecto global
  routes:
    my-gateway: deepseek # anulación por ruta
```

## Permisos y datos

| Alcance | Qué toca |
| --- | --- |
| Archivos (lectura) | ninguno — no se leen ni escriben archivos de usuario (los ajustes van por el servicio de settings de DSH) |
| Red | ninguna propia — el panel lee y escribe el directorio en el navegador del Model Controller; la llamada resultante a `session.selectModel` viaja por la conexión existente de DSH |
| Credenciales | nunca se leen |
| Datos de usuario | no se leen (sin acceso al contenido de conversaciones/mensajes/prompts; solo provider/model/`reasoningEffort` de la sesión actual a través del directorio de modelos compartido) |

## Cómo funciona

| Mitad | Archivo | Función |
| --- | --- | --- |
| Host | `lib/index.js` | Aprovisionamiento universal de esfuerzo: parches de cable pi-ai (`buildProvisionOps`, idempotente, respeta las declaraciones del usuario) + la sección de ajustes `effort-slider` instalada vía `settings.installSection`; escucha `llm/adapters-updated` / `settings/updated` para aplicarse en caliente |
| Navegador | `lib/client.js` | Captura los clics en la fila Effort del menú de modelos → muestra el panel Effort; lee `ctx.modelDirectories.directoryFor(sessionId)` y escribe con `directory.select({ reasoningEffort })`; un MutationObserver mantiene vivo el color de nivel de la fila del menú tras cerrar el panel |

> La parte del navegador sigue la convención oficial de plugins externos: script clásico + factoría `window.__ModuleLoader__.load`; `react` / `react-dom/client` / `react/jsx-runtime` son externals de plataforma; `effort.module.css` se hashea e incrusta con lightningcss, inyectado como `<style data-plugin>` cuando se ejecuta la factoría.

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| No hay fila Effort en el menú de modelos | El modelo no declara metadatos de razonamiento y el aprovisionamiento del host no actúa — confirma que reiniciaste DSH y revisa `effort-slider.enabled` en `~/.dsh/settings.yaml` |
| El panel dice 「当前模型不支持思考强度调节」 | El respaldo universal no está activo — actualiza a v0.2.0+ y reinicia |
| El plugin no carga en absoluto (la fila muestra `disabled: true`) | Una compilación anterior quedó desactivada en `~/.dsh/profiles/web/cordis.patch.yml`; borra esa fila y reinicia |
| Arrastrar no tiene efecto | Comprueba si el dialecto de cable del endpoint coincide (ver tabla de dialectos) o fija `defaultDialect` para esa ruta |
| Conflictos con otros plugins de piel | Si tienes otra piel que intercepta la fila Effort (p. ej. la piel aurora de dsh-ui-web), desactiva su intercepción para evitar paneles dobles |
| La versión sigue mostrando la antigua tras reiniciar | Las instalaciones `file:` son copias instantáneas — usa la especificación `github:` o reejecuta `add` antes de reiniciar |
| ¿Dónde están los registros? | Errores del host: log de arranque de DSH; errores del cliente: Consola de DevTools del navegador (F12) (prefijo `[effort-slider]`) |

## Estructura del proyecto

```text
src/
  index.ts                  mitad host: aprovisionamiento de cable pi-ai + sección de ajustes
  effort-core.ts             lógica pura: mapeo dialecto → cable, generación de parches de aprovisionamiento (testeada)
  client/
    index.ts                mitad navegador: intercepción de la fila Effort + ancla del panel + coloreado de la fila del menú
    css-modules.d.ts
    effort/
      directory.ts          cara estructural de ctx.modelDirectories / ctx.sessions (solo tipos, sin import del runtime de DSH)
      EffortPanel.tsx       Panel Effort (niveles / marcas / deslizador / brillo)
      useWebglFire.ts       Bucle de fuego WebGL2 de tres pasadas (seguimiento con resorte + reposo en inactividad)
      shaders.ts            shaders de vértices / ignición / desenfoque / composición
      effortColors.ts       mapeo nivel → color (compartido por panel y fila del menú)
      effort.module.css     estilos del panel (incrustados vía lightningcss)
cordis.patch.yml           parche de bundle (inserta la fila ui-effort-slider)
lib/                       artefactos compilados (client.js incluye sourcemap)
test/                      pruebas unitarias host.spec.mjs + host-apply.spec.mjs + client.smoke.mjs
```

## Desarrollo

```sh
pnpm install
pnpm build       # tsdown → lib/index.js (mitad host) + lib/client.js (mitad navegador)
pnpm typecheck   # tsc --noEmit (en verde contra @deepseek-ai/* 0.1.5-rc.1)
pnpm test        # unitarias del host + integración apply + integración de costura real + smoke jsdom
```

Capas de `test/`, de la más barata a la más costosa:

| Archivo | Alcance |
| --- | --- |
| `host.spec.mjs` | Lógica pura: mapeo dialecto → cable, generación de parches de aprovisionamiento, idempotencia |
| `host-apply.spec.mjs` | `apply()` contra un contexto cordis simulado: reintento por registro tardío de la sección pi-ai, control de `compat` según el protocolo declarado |
| `host-integration.spec.mjs` | **Costura real**: `@deepseek-ai/cordis` real + proveedor `@deepseek-ai/dsh-settings-file` real — registro de `installSection`, escrituras path-op reales aterrizando en un documento de ajustes, y el `reasoningEfforts`/`compat` escrito pasando las reglas de validación de pi-ai |
| `client.smoke.mjs` | jsdom: materialización de la factoría del bundle, intercepción de la fila Effort, render del panel, escrituras de arrastre/ajuste vía `directory.select`, coloreado, limpieza al desmontar |

**Contribuir.** Fork → cambiar → `pnpm build` → ejecutar `pnpm test` → abrir un PR contra `main`. Los arreglos pequeños (documentación, pruebas) son bienvenidos sin discusión previa; reporta issues con la versión de DSH y el error exacto.

## Licencia y seguridad

**Licencia**: BSD-3-Clause — ver [LICENSE](../../LICENSE).
La implementación de la interfaz referencia la piel aurora del proyecto comunitario dsh-ui-web (BSD-3-Clause); los avisos completos de origen y los textos de licencia están en
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

**Seguridad**: este plugin no lee credenciales ni envía nada por la red (solo habla con el DSH local). Para reportar un problema de seguridad de forma privada, usa **Report a vulnerability** en la pestaña Security de GitHub — no abras un issue público con detalles de explotación.

---

<div align="center">

BSD-3-Clause © [2768651338](https://github.com/2768651338)

</div>
