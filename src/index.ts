/**
 * dsh-effort-slider 宿主半区 —— 通用思考强度供给器。
 *
 * 让任何自定义的第三方模型/提供商都能使用思考强度（并产生线上实际作用）：
 * 1. 线级供给（pi-ai）：为 llm-pi-ai 设置里缺少 reasoningEfforts 的自定义模型
 *    自动补写 reasoningEfforts 字典 + compat 线方言（热生效，无需重启）——
 *    pi-ai 既按方言把档位翻译成 reasoning_effort / thinking 等真实线上字段，
 *    也据同一份声明向目录暴露 reasoning 元数据，因此官方模型菜单的「推理等级」
 *    行会随之出现；
 * 2. 纯目录路由：为缺少原生 reasoning 的目录模型写 modelOverrides；
 * 3. 设置段 effort-slider：全局开关 + 默认线方言 + 按路由覆盖。
 *
 * 与 0.1.x 早期版本的差异：dsh-llm 已把适配器注册表私有化（`llm.adapters`
 * 不再是公开面），原先「包装 adapter.resolveModel 注入 reasoning 元数据」的
 * 做法不再可行，也不再需要——pi-ai 的 reasoningEfforts 声明同时供给目录元数据
 * 与线上字段，一条路径即可覆盖全部自定义第三方模型。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import {
  DIALECT_KEYS,
  buildProvisionOps,
  type PiAiProfile,
  type PathOp,
  type WireDialect,
} from './effort-core.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-effort-slider'

/** 注入的宿主服务：llm（模型目录查询）、settings（设置段读写）。 */
export const inject = ['llm', 'settings']

/** 本插件设置段命名空间。 */
const NS = 'effort-slider'
/** pi-ai 适配器的设置段命名空间（线级供给目标）。 */
const PI_AI_NS = 'llm-pi-ai'

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

/** pi-ai 设置段的形态（仅本插件用到的成员）。 */
interface PiAiSection {
  providers?: Record<string, PiAiProfile>
}

/**
 * 应用宿主半区：pi-ai 线级供给 + 设置段。
 * @param ctx - cordis 宿主上下文。
 * @param config - 插件行配置（作为设置段 base 层，可被用户设置覆盖）。
 */
export function apply(ctx: Context, config?: Partial<EffortSliderConfig>): void {
  const base: EffortSliderConfig = { enabled: true, defaultDialect: 'effort', routes: {}, ...config }
  let current: () => EffortSliderConfig = () => base
  const options = (): EffortSliderConfig => current()

  const llm: LlmRuntime | undefined = ctx.get('llm')
  const settings: SettingsProvider | undefined = ctx.get('settings')
  if (llm === undefined || settings === undefined) {
    ctx.logger.warn('effort-slider: llm/settings service unavailable — host provisioning disabled')
    return
  }

  // pi-ai 的 settings 段注册晚于其 adapter（installSection 在 registerAdapter
  // 之后，且注册本身不触发 settings/updated），所以 adapters-updated 事件先到时
  // settings.get('llm-pi-ai') 仍为 undefined。这里在段尚未就绪时做有上限的
  // 延迟重试，避免供给空跑后永不再触发。
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  const RETRY_MAX = 60 // 500ms × 60 = 30s 上限
  const piAiReady = (): boolean => settings.get(PI_AI_NS) !== undefined

  const section = (): PiAiSection | undefined => settings.get(PI_AI_NS) as PiAiSection | undefined

  const scheduleRetry = (): void => {
    if (retryTimer !== null || retryCount >= RETRY_MAX) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryCount += 1
      if (piAiReady()) {
        retryCount = 0
        void provision()
        return
      }
      scheduleRetry()
    }, 500)
  }

  // ---- 1. 线级供给：为 pi-ai 自定义模型补写 reasoningEfforts / compat ----
  const nativeReasoning = new Map<string, boolean>()
  const hasNativeReasoning = async (route: string, modelId: string): Promise<boolean> => {
    const key = `${route}\u0000${modelId}`
    const memo = nativeReasoning.get(key)
    if (memo !== undefined) return memo
    let result = false
    try {
      const info = await llm.resolveModelInfo(route, modelId)
      result = info?.reasoning !== undefined
    } catch {
      result = false
    }
    nativeReasoning.set(key, result)
    return result
  }

  const runProvision = async (): Promise<boolean> => {
    const cfg = options()
    if (!cfg.enabled) return true
    const sectionValue = section()
    if (sectionValue === undefined) {
      // pi-ai settings 段尚未注册：延迟重试，直到段就绪。
      scheduleRetry()
      return false
    }
    const providers = sectionValue.providers
    if (providers === undefined || Object.keys(providers).length === 0) return true
    const ops: PathOp[] = []
    for (const [route, profile] of Object.entries(providers)) {
      const dialect = cfg.routes[route] ?? cfg.defaultDialect
      // 模型级 compat 只对声明了 openai-completions 的路由合法：pi-ai 会拒绝
      // 「协议读不到的开关」。路由未声明 api 时只注入 reasoningEfforts。
      const apiOf = (): string | undefined => profile.api
      const models = profile.models
      let catalogIds: string[] = []
      if (models === undefined || models.length === 0) {
        // 纯目录路由：枚举目录模型，逐个判断是否缺 reasoning
        try {
          const listed = await llm.listModels(route)
          catalogIds = listed
            .map((entry) => entry.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        } catch {
          catalogIds = []
        }
      }
      const newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds)
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
      // 目录模型的原生 reasoning 判定可能因刚写入的声明而过期，下次重新解析。
      nativeReasoning.clear()
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

  // ---- 2. 设置段 + 事件联动 ----
  settings.installSection(ctx, NS, Config, base, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {
      void provision()
    },
  })
  ctx.on('llm/adapters-updated', () => {
    void provision()
  })
  ctx.on('settings/updated', (ns) => {
    if (ns === PI_AI_NS) void provision()
  })

  void provision()

  ctx.effect(
    () => () => {
      if (retryTimer !== null) clearTimeout(retryTimer)
      retryTimer = null
    },
    'ui-effort-slider: provisioning retry cleanup',
  )
}
