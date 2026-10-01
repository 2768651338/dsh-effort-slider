/**
 * dsh-effort-slider 宿主半区 —— 通用思考强度供给器。
 *
 * 让任何自定义的第三方模型/提供商都能使用思考强度（并产生线上实际作用）：
 * 1. 线级供给（pi-ai）：为 llm-pi-ai 配置里缺少 reasoningEfforts 的自定义模型
 *    自动补写 reasoningEfforts 字典 + compat 线方言（热生效，无需重启）——
 *    pi-ai 既按方言把档位翻译成 reasoning_effort / thinking 等真实线上字段，
 *    也据同一份声明向目录暴露 reasoning 元数据，因此官方模型菜单的「推理等级」
 *    行会随之出现；
 * 2. 纯目录路由：为缺少原生 reasoning 的目录模型写 modelOverrides；
 * 3. 本插件配置（enabled / defaultDialect / routes）由 profile 条目配置承载，
 *    DSH 设置页可改，变更后插件按 cordis 语义重启重挂载。
 *
 * 与 0.1.x 的差异：DSH 0.2.0 移除了独立 settings 文档与命名空间注册
 * （installSection / settings.get / settings/updated 全部消失），设置即
 * profile 条目配置（SettingsForms）。pi-ai 的 providers 就挂在其条目配置上，
 * 条目 id 默认即「llm-pi-ai」（pi-ai 以 ctx.fiber.entry?.options.id 兜底同名
 * 常量声明 settingsNs，可配置提供方目录的每个条目都携带它）。本插件据此：
 * - 读：settings.describe() 里找 pi-ai 条目（ns === 'llm-pi-ai' 优先，其次
 *   用 llm.listConfigurableProviders() 的 settingsNs 交叉定位），取其
 *   resolved value 的 providers；
 * - 写：settings.mutate(条目id, ops)，op 路径相对条目配置根
 *   （providers.<route>...，与 0.1.x 的段内路径完全一致）；
 * - 听：settings/document-updated(ns) 与 llm/adapters-updated。
 * 与 0.1.x 相同：dsh-llm 的适配器注册表已私有化（`llm.adapters` 不是公开面），
 * 供给全走 pi-ai 的 reasoningEfforts 声明这一条路径。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { SettingsForms } from '@deepseek-ai/dsh-settings'
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

/** 注入的宿主服务：llm（模型目录查询）、settings（profile 条目配置表单）。 */
export const inject = ['llm', 'settings']

/**
 * 本插件条目配置（DSH 0.2.0 设置页由插件导出的 Config 自动生成；
 * 变更按 cordis 语义重启本插件，供给幂等因此无需热更新钩子）。
 */
export const Config = z.object({
  enabled: z.boolean().default(true),
  defaultDialect: z.union(DIALECT_KEYS).default('effort'),
  routes: z.dict(z.union(DIALECT_KEYS)).default({}),
})

/** pi-ai 条目 id 的默认值（pi-ai 0.2.0 的 NS 常量；仅当条目被改名时失配）。 */
const PI_AI_DEFAULT_NS = 'llm-pi-ai'

interface EffortSliderConfig {
  enabled: boolean
  defaultDialect: WireDialect
  routes: Record<string, WireDialect>
}

/** pi-ai 条目配置的形态（仅本插件用到的成员）。 */
interface PiAiEntryValue {
  providers?: Record<string, PiAiProfile>
}

/** settings.describe() 返回的条目形态（仅本插件用到的成员）。 */
interface SettingsForm {
  ns: string
  value?: unknown
}

/** 判断一个条目 resolved value 是否是 pi-ai 形状（顶层 providers 对象）。 */
function isPiAiValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const providers = (value as Record<string, unknown>).providers
  return typeof providers === 'object' && providers !== null
}

/**
 * 应用宿主半区：pi-ai 线级供给。
 * @param ctx - cordis 宿主上下文。
 * @param config - 本插件条目配置（patch base / 设置页补丁解析后的值）。
 */
export function apply(ctx: Context, config?: Partial<EffortSliderConfig>): void {
  const cfg: EffortSliderConfig = { enabled: true, defaultDialect: 'effort', routes: {}, ...config }

  const llm: LlmRuntime | undefined = ctx.get('llm')
  const settings: SettingsForms | undefined = ctx.get('settings')
  if (llm === undefined || settings === undefined) {
    ctx.logger.warn('effort-slider: llm/settings service unavailable — host provisioning disabled')
    return
  }

  const forms = (): SettingsForm[] => {
    try {
      return (settings.describe() ?? []) as SettingsForm[]
    } catch {
      return []
    }
  }

  /**
   * 定位 pi-ai 条目 id。优先按约定 id 直配；失配（条目被改名）时用 llm 的
   * 可配置提供方目录交叉定位——pi-ai 目录条目携带它自己的 settingsNs。
   */
  let piAiNs: string | undefined
  const findPiAiNs = (): string | undefined => {
    const all = forms()
    const direct = all.find((form) => form.ns === PI_AI_DEFAULT_NS)
    if (direct !== undefined && isPiAiValue(direct.value)) return direct.ns
    let directoryNs: Set<string> | undefined
    try {
      directoryNs = new Set(llm.listConfigurableProviders().map((entry) => entry.settingsNs))
    } catch {
      directoryNs = undefined
    }
    for (const form of all) {
      if (directoryNs?.has(form.ns) === true && isPiAiValue(form.value)) return form.ns
    }
    return undefined
  }

  // pi-ai 的条目挂载可能晚于本插件（loader 逐条目装配），这里在 describe()
  // 尚无 pi-ai 条目时做有上限的延迟重试，避免供给空跑后永不再触发。
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  const RETRY_MAX = 60 // 500ms × 60 = 30s 上限

  const scheduleRetry = (): void => {
    if (retryTimer !== null || retryCount >= RETRY_MAX) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryCount += 1
      if (findPiAiNs() !== undefined) {
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
    if (!cfg.enabled) return true
    const targetNs = findPiAiNs()
    if (targetNs === undefined) {
      // pi-ai 条目尚未挂载：延迟重试，直到条目就绪。
      scheduleRetry()
      return false
    }
    piAiNs = targetNs
    const entry = forms().find((form) => form.ns === targetNs)
    const providers = isPiAiValue(entry?.value)
      ? (entry?.value as PiAiEntryValue).providers
      : undefined
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
            .map((entryModel) => entryModel.id)
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
      await settings.mutate(targetNs, ops)
      // 目录模型的原生 reasoning 判定可能因刚写入的声明而过期，下次重新解析。
      nativeReasoning.clear()
    } catch (error) {
      ctx.logger.warn('effort-slider: pi-ai entry mutate refused')
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

  // ---- 2. 事件联动 ----
  ctx.on('llm/adapters-updated', () => {
    void provision()
  })
  ctx.on('settings/document-updated', (ns: unknown) => {
    // pi-ai 条目配置变化（含本插件自己的写入回声）触发复判；幂等保证收敛。
    if (typeof ns === 'string' && ns === piAiNs) void provision()
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
