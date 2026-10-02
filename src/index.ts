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
 * 3. 本插件配置（enabled / defaultDialect / routes / debugReport）由 profile
 *    条目配置承载，DSH 设置页可改，变更后插件按 cordis 语义重启重挂载。
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
  deepEqualJson,
  dialectAppliesNote,
  type PiAiProfile,
  type PathOp,
  type ProvisionAction,
  type ProvisionDecision,
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
  // 供给诊断报告（P3-1）：开启后每轮供给输出逐路由逐模型明细（写入了什么/
  // 为何跳过），替代单行计数。明细行数与模型数成正比，默认关闭平衡日志噪音。
  debugReport: z.boolean().default(false),
})

/** pi-ai 条目 id 的默认值（pi-ai 0.2.0 的 NS 常量；仅当条目被改名时失配）。 */
const PI_AI_DEFAULT_NS = 'llm-pi-ai'

interface EffortSliderConfig {
  enabled: boolean
  defaultDialect: WireDialect
  routes: Record<string, WireDialect>
  debugReport: boolean
}

/** pi-ai 条目配置的形态（仅本插件用到的成员）。 */
interface PiAiEntryValue {
  providers?: Record<string, PiAiProfile>
}

/** settings.describe() 返回的条目形态（仅本插件用到的成员）。 */
interface SettingsForm {
  ns: string
  value?: unknown
  /** 条目修订号（0.2.0 契约携带；缺失时快照一致性退化为值深比较）。 */
  revision?: unknown
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
  const cfg: EffortSliderConfig = {
    enabled: true,
    defaultDialect: 'effort',
    routes: {},
    debugReport: false,
    ...config,
  }

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
  let retryExhaustedWarned = false
  const RETRY_MAX = 60 // 500ms × 60 = 30s 上限

  const scheduleRetry = (): void => {
    if (retryTimer !== null) return
    if (retryCount >= RETRY_MAX) {
      // 重试耗尽必须留下线索：慢机器冷启动时 pi-ai 条目 30s 后才挂载，
      // 用户看到的只是「自定义模型没有 Effort 行」，日志里原本一个字都没有。
      if (!retryExhaustedWarned) {
        retryExhaustedWarned = true
        ctx.logger.warn(`effort-slider: pi-ai entry not mounted after ${RETRY_MAX} retries (30s) — provisioning paused until the next trigger event`)
      }
      return
    }
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryCount += 1
      if (findPiAiNs() !== undefined) {
        retryCount = 0
        retryExhaustedWarned = false
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
    try {
      const info = await llm.resolveModelInfo(route, modelId)
      const result = info?.reasoning !== undefined
      nativeReasoning.set(key, result)
      return result
    } catch (error) {
      // 解析异常 ≠ 确认无原生 reasoning：异常不进缓存（否则网络抖动期间会把
      // 原生 reasoning 模型永久误判，进而向它写 modelOverrides），只记日志并
      // 按「本轮未知」处理。
      ctx.logger.warn(`effort-slider: resolveModelInfo(${route}, ${modelId}) failed — treated as no native reasoning for this round`)
      ctx.logger.warn(error)
      return false
    }
  }

  // ---- debugReport（P3-1）：逐条输出供给明细，替代单行计数 ----
  const SKIP_REASONS: Record<Exclude<ProvisionAction, 'write'>, string> = {
    'skip-user-false': 'user-declared reasoningEfforts:false kept untouched',
    'skip-user-custom': 'user-declared custom dictionary kept untouched',
    'skip-native-reasoning': 'native reasoning already declared',
    'skip-current': 'already current for this dialect',
    'skip-empty': 'no models declared and no catalog models',
  }

  const describeDecision = (d: ProvisionDecision): string => {
    const where = d.model === undefined ? `route "${d.route}"` : `route "${d.route}" model "${d.model}"`
    const api = d.api === undefined ? '' : ` api=${d.api}`
    const action = d.action === 'write'
      ? `write ${d.fields?.join(' + ') ?? '(nothing)'}`
      : `skip: ${SKIP_REASONS[d.action]}`
    // 方言适用性备注（P3-2）：我们真正参与决定写入与否的行（write/skip-current）
    // 才需要注明方言何时才作用于线上；用户声明跳过、原生 reasoning 跳过与我们无关。
    const note = (d.action === 'write' || d.action === 'skip-current')
      ? dialectAppliesNote(d.api)
      : undefined
    return `${where} dialect=${d.dialect}${api} → ${action}${note === undefined ? '' : ` ${note}`}`
  }

  const emitDebugReport = (report: ProvisionDecision[], opCount: number): void => {
    ctx.logger.info(`effort-slider: [debug] provisioning report — ${report.length} decision(s), ${opCount} field op(s)`)
    for (const d of report) ctx.logger.info(`effort-slider: [debug] ${describeDecision(d)}`)
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
    // 条目已就绪：延迟重试周期结束（含耗尽告警状态一并复位）。
    retryCount = 0
    retryExhaustedWarned = false
    const entry = forms().find((form) => form.ns === targetNs)
    const providers = isPiAiValue(entry?.value)
      ? (entry?.value as PiAiEntryValue).providers
      : undefined
    if (providers === undefined || Object.keys(providers).length === 0) return true
    const ops: PathOp[] = []
    // debugReport 开启时收集逐模型决策，供本轮结束时输出明细（P3-1）。
    const report: ProvisionDecision[] = []
    const onDecision = cfg.debugReport
      ? (decision: ProvisionDecision) => { report.push(decision) }
      : undefined
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
        } catch (error) {
          // 纯目录路由枚举失败原先静默置空——表现为「该路由模型没有 Effort
          // 行」而日志无痕。失败路径必记日志（成功路径保持只有一行计数）。
          ctx.logger.warn(`effort-slider: listModels failed for route "${route}" — catalog route skipped this round`)
          ctx.logger.warn(error)
          catalogIds = []
        }
      }
      const decisionsBefore = report.length
      let newOps: PathOp[]
      if (catalogIds.length > 0) {
        // 目录模型需跳过已有原生 reasoning 的条目：先解析判定（有 memo），
        // 再作为谓词传入 buildProvisionOps——跳过发生在生成 ops 之前，
        // debugReport 才能把「原生 reasoning 已声明」如实报出来。
        const nativeIds = new Set<string>()
        for (const id of catalogIds) {
          if (await hasNativeReasoning(route, id)) nativeIds.add(id)
        }
        newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds, (id) => nativeIds.has(id), onDecision)
      } else {
        newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds, undefined, onDecision)
      }
      ops.push(...newOps)
      // 路由级明细：显式 models 为空、目录枚举又没给出任何模型（枚举失败
      // 或为空）时，这条路由整轮无事可做——补一条路由级跳过，避免它从报告里消失。
      if (cfg.debugReport && report.length === decisionsBefore) {
        report.push({ route, dialect, action: 'skip-empty' })
      }
    }
    if (ops.length === 0) {
      // debugReport 的空轮同样要报：全部「已是最新 / 用户声明跳过」恰好
      // 证明插件核对过每一个模型且没有乱写，这正是排查时最需要的信息。
      if (cfg.debugReport) emitDebugReport(report, 0)
      return true
    }
    // 竞态防御：上面的 ops 基于先前快照计算，而 models 只能整数组替换——
    // 若快照读取后用户恰好在设置页编辑了 pi-ai 条目，这次写入会覆盖用户的
    // 修改，且写入后的幂等回声会掩盖丢失。mutate 前重读一次，快照已前移
    // （revision 变化或值不再一致）就放弃本轮：用户的编辑会触发
    // document-updated，下一轮供给基于新快照自然重来。
    const reread = forms().find((form) => form.ns === targetNs)
    const unchanged = entry !== undefined && reread !== undefined && (
      (typeof entry.revision === 'number' && typeof reread.revision === 'number')
        ? reread.revision === entry.revision
        : deepEqualJson(entry.value, reread.value)
    )
    if (!unchanged) {
      ctx.logger.info('effort-slider: pi-ai entry changed during provisioning — deferring to the newer edit')
      return true
    }
    if (cfg.debugReport) {
      // 明细替代单行计数（P3-1）：逐路由逐模型报告写入了什么、为何跳过。
      emitDebugReport(report, ops.length)
    } else {
      ctx.logger.info(`effort-slider: provisioning ${ops.length} field(s) across pi-ai models`)
    }
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

  // 请求追踪（debugReport 开启时，P3-2）：方言排查链上今天唯一可观测的一段
  // ——档位是否随请求下发（llm/stream 瀑布，只读透传）。线上翻译发生在
  // pi-ai 适配器内部、请求体不可见，因此只记录事实、不推断方言对错：
  // 追踪能证明「档位已下发」，剩下的嫌疑才收敛到线上翻译层。
  if (cfg.debugReport) {
    ctx.on('llm/stream', (options, next) => {
      const purpose = options.purpose === undefined ? '' : ` purpose=${options.purpose}`
      ctx.logger.info(`effort-slider: [debug] request route=${options.provider} model=${options.model} effort=${options.reasoningEffort ?? '(none)'}${purpose}`)
      return next()
    })
  }

  void provision()

  ctx.effect(
    () => () => {
      if (retryTimer !== null) clearTimeout(retryTimer)
      retryTimer = null
    },
    'ui-effort-slider: provisioning retry cleanup',
  )
}
