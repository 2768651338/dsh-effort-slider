/**
 * dsh-effort-slider 宿主半区 —— 通用思考强度供给器。
 *
 * 让任何自定义的第三方模型/提供商都能使用思考强度（并产生线上实际作用）：
 * 1. 元数据供给：对未声明 reasoning 的适配器模型注入通用 5 档刻度
 *    （OFF/Low/Medium/High/Ultracode），使选择器可用且请求校验通过；
 * 2. 线级供给（pi-ai）：为 llm-pi-ai 设置里缺少 reasoningEfforts 的自定义模型
 *    自动补写 reasoningEfforts 字典 + compat 线方言（热生效，无需重启），
 *    使 pi-ai 按方言把档位翻译成 reasoning_effort / thinking 等真实线上字段；
 * 3. 设置段 effort-slider：全局开关 + 默认线方言 + 按路由覆盖。
 */
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import {
  DIALECT_KEYS,
  buildProvisionOps,
  universalReasoning,
  type PiAiProfile,
  type PathOp,
  type WireDialect,
} from './effort-core.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-effort-slider'

/** 注入的宿主服务：llm（适配器注册表）、settings（设置段读写）。 */
export const inject = ['llm', 'settings']

/** 本插件设置段命名空间。 */
const NS = settingsNamespace('effort-slider')
/** pi-ai 适配器的设置段命名空间（线级供给目标）。 */
const PI_AI_NS = settingsNamespace('llm-pi-ai')

interface EffortSliderConfig {
  enabled: boolean
  defaultDialect: WireDialect
  routes: Record<string, WireDialect>
}

const Config = z.object({
  enabled: z.boolean().default(true),
  defaultDialect: z.union(DIALECT_KEYS).default('effort'),
  routes: z.dict(z.union(DIALECT_KEYS)).default({}),
})

/** 结构化的 llm 服务面（仅本插件用到的成员）。 */
interface LlmServiceLike {
  adapters: Map<string, { adapter: AdapterLike }>
  listModels(provider: string): Promise<Array<string | { id?: string }>>
  resolveModelInfo(provider: string, model: string, signal?: unknown): Promise<{ reasoning?: unknown }>
}

interface AdapterLike {
  resolveModel?: (provider: string, model: string, signal?: unknown) => Promise<{ reasoning?: unknown }>
  current?: () => { models?: { getModel?: (provider: string, model: string) => { api?: string } | undefined } }
}

interface SettingsServiceLike {
  get(ns: string): unknown
  mutate(ns: string, ops: PathOp[]): Promise<unknown>
}

/**
 * 应用宿主半区：适配器元数据包装 + pi-ai 线级供给 + 设置段。
 * @param ctx - cordis 宿主上下文。
 * @param config - 插件行配置（作为设置段 base 层，可被用户设置覆盖）。
 */
export function apply(ctx: Context, config?: Partial<EffortSliderConfig>): void {
  const base: EffortSliderConfig = { enabled: true, defaultDialect: 'effort', routes: {}, ...config }
  let current: () => EffortSliderConfig = () => base
  const options = (): EffortSliderConfig => current()

  const llm = ctx.get('llm') as LlmServiceLike | undefined
  const settings = ctx.get('settings') as SettingsServiceLike | undefined
  if (llm === undefined || settings === undefined) {
    ctx.logger.warn('effort-slider: llm/settings service unavailable — host provisioning disabled')
    return
  }

  // pi-ai 的 settings 段注册晚于其 adapter（installSettingsSection 在
  // registerAdapter 之后，且 register 不触发 settings/updated），所以
  // adapters-updated 事件先到时 settings.get('llm-pi-ai') 仍为 undefined。
  // 这里在段尚未就绪时做有上限的延迟重试，避免供给空跑后永不再触发。
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  const RETRY_MAX = 60 // 500ms × 60 = 30s 上限
  const piAiReady = (): boolean => settings.get(PI_AI_NS) !== undefined

  // ---- 1. 元数据供给：包装未声明 reasoning 的适配器模型 ----
  const wrapped = new WeakSet<AdapterLike>()
  const piAiRoutes = (): Set<string> => {
    const section = settings.get(PI_AI_NS) as { providers?: Record<string, unknown> } | undefined
    return new Set(Object.keys(section?.providers ?? {}))
  }
  const wrapAdapter = (adapter: AdapterLike): void => {
    if (typeof adapter.resolveModel !== 'function') return
    const original = adapter.resolveModel.bind(adapter)
    adapter.resolveModel = async (provider: string, model: string, signal?: unknown) => {
      const info = await original(provider, model, signal)
      if (info !== null && typeof info === 'object' && info.reasoning === undefined) {
        return { ...info, reasoning: universalReasoning('off') }
      }
      return info
    }
  }
  const scheduleRetry = (): void => {
    if (retryTimer !== null || retryCount >= RETRY_MAX) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryCount += 1
      if (piAiReady()) {
        retryCount = 0
        wrapAdapters()
        void provision()
        return
      }
      scheduleRetry()
    }, 500)
  }

  const wrapAdapters = (): void => {
    if (!piAiReady()) {
      // pi-ai 段尚未就绪，piRoutes 不完整，会把 pi-ai 适配器误包装；
      // 延迟重试到段就绪后再做（事件驱动路径也会再触发）。
      scheduleRetry()
      return
    }
    const piRoutes = piAiRoutes()
    for (const [provider, registration] of llm.adapters) {
      // pi-ai 自有路由不包装：其线上翻译由第 2 步的线级供给完成
      if (piRoutes.has(provider)) continue
      const adapter = registration.adapter
      if (wrapped.has(adapter)) continue
      wrapped.add(adapter)
      wrapAdapter(adapter)
    }
  }

  // ---- 2. 线级供给：为 pi-ai 自定义模型补写 reasoningEfforts / compat ----
  const apiResolverFor = (route: string): ((modelId: string) => string | undefined) => {
    const adapter = llm.adapters.get(route)?.adapter
    return (modelId: string) => {
      try {
        return adapter?.current?.()?.models?.getModel?.(route, modelId)?.api
      } catch {
        return undefined
      }
    }
  }
  const nativeReasoning = new Map<string, boolean>()
  const hasNativeReasoning = async (route: string, modelId: string): Promise<boolean> => {
    const key = `${route}\u0000${modelId}`
    const memo = nativeReasoning.get(key)
    if (memo !== undefined) return memo
    let result = false
    try {
      const info = await llm.resolveModelInfo(route, modelId)
      result = (info as { reasoning?: unknown } | undefined)?.reasoning !== undefined
    } catch {
      result = false
    }
    nativeReasoning.set(key, result)
    return result
  }

  const runProvision = async (): Promise<boolean> => {
    const cfg = options()
    if (!cfg.enabled) return true
    const section = settings.get(PI_AI_NS) as { providers?: Record<string, PiAiProfile> } | undefined
    if (section === undefined) {
      // pi-ai settings 段尚未注册：延迟重试，直到段就绪。
      scheduleRetry()
      return false
    }
    const providers = section?.providers
    if (providers === undefined || Object.keys(providers).length === 0) return true
    const ops: PathOp[] = []
    for (const [route, profile] of Object.entries(providers)) {
      const dialect = cfg.routes[route] ?? cfg.defaultDialect
      const apiOf = apiResolverFor(route)
      const models = profile.models
      let catalogIds: string[] = []
      if (models === undefined || models.length === 0) {
        // 纯目录路由：枚举目录模型，逐个判断是否缺 reasoning
        try {
          const listed = await llm.listModels(route)
          catalogIds = listed.map((entry) => (typeof entry === 'string' ? entry : entry.id)).filter((id): id is string => typeof id === 'string' && id.length > 0)
        } catch {
          catalogIds = []
        }
      }
      const newOps = await buildProvisionOps(
        route,
        profile,
        dialect,
        apiOf,
        catalogIds,
        (modelId) => false,
      )
      // 目录模型需跳过已有原生 reasoning 的条目
      if (catalogIds.length > 0) {
        const nativeIds = new Set<string>()
        for (const id of catalogIds) {
          if (await hasNativeReasoning(route, id)) nativeIds.add(id)
        }
        ops.push(...newOps.filter((op) => {
          const marker = op.path.indexOf('modelOverrides')
          if (marker < 0) return true
          const modelId = op.path[marker + 1]
          return modelId !== undefined && !nativeIds.has(modelId)
        }))
      } else {
        ops.push(...newOps)
      }
    }
    if (ops.length === 0) return true
    ctx.logger.info(`effort-slider: provisioning ${ops.length} field(s) across pi-ai models`)
    try {
      await settings.mutate(PI_AI_NS, ops)
    } catch (error) {
      ctx.logger.warn('effort-slider: pi-ai settings mutate refused')
      ctx.logger.warn(error)
    }
    return true
  }

  let provisionTail: Promise<void> = Promise.resolve()
  let queued = false
  const provision = (): Promise<void> => {
    queued = true
    provisionTail = provisionTail.then(async () => {
      if (!queued) return
      queued = false
      await runProvision()
    }).catch((error) => {
      queued = false
      ctx.logger.warn('effort-slider: provisioning failed')
      ctx.logger.warn(error)
    })
    return provisionTail
  }

  // ---- 3. 设置段 + 事件联动 ----
  installSettingsSection(ctx, NS, Config, base, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {
      void provision()
    },
  })
  ctx.on('llm/adapters-updated', () => {
    wrapAdapters()
    void provision()
  })
  ctx.on('settings/updated', (ns: string) => {
    if (ns === PI_AI_NS) void provision()
  })

  wrapAdapters()
  void provision()

  ctx.effect(
    () => () => {
      if (retryTimer !== null) clearTimeout(retryTimer)
      retryTimer = null
    },
    'ui-effort-slider: provisioning retry cleanup',
  )
}
