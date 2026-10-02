/**
 * dsh-effort-slider 宿主侧纯逻辑（无外部依赖，便于单测）。
 * 通用思考强度供给器：为任何缺少 reasoning 元数据的模型提供 5 档刻度，
 * 并按线方言生成 pi-ai 可消费的 reasoningEfforts / compat 配置。
 */

/** 支持的自定义端点线方言。 */
export const DIALECT_KEYS = [
  'effort',
  'deepseek',
  'openrouter',
  'together',
  'zai',
  'qwen',
  'string-thinking',
  'ant-ling',
] as const
export type WireDialect = (typeof DIALECT_KEYS)[number]

/** 通用 5 档刻度 id（与客户端兜底刻度一致；pi-ai 原生词汇的子集）。 */
export const UNIVERSAL_EFFORT_IDS = ['off', 'low', 'medium', 'high', 'max'] as const

/** 通用 reasoning 元数据（注入给未声明 reasoning 的适配器模型）。 */
export function universalReasoning(defaultEffort: string = 'off'): {
  efforts: Array<{ id: string; name: string }>
  defaultEffort: string
} {
  return {
    efforts: [
      { id: 'off', name: 'OFF' },
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' },
      { id: 'high', name: 'High' },
      { id: 'max', name: 'Ultracode' },
    ],
    defaultEffort,
  }
}

/**
 * 每个线方言的线级映射：reasoningEfforts 字典（pi-ai THINKING_LEVELS 词汇），
 * off 恒为 null（pi-ai 语义：声明支持、不发参数），其余档位为线上拼写。
 */
const WIRE: Record<string, string | null> = {
  off: null,
  low: 'low',
  medium: 'medium',
  high: 'high',
  max: 'max',
}

/**
 * 计算一个模型按方言应注入的 pi-ai 配置。
 * @param dialect - 线方言。
 * @param apiIsOpenAiCompletions - 模型是否走 openai-completions 协议
 *   （compat 开关只对该协议合法，其余协议仅注入 reasoningEfforts）。
 */
export function wireFor(
  dialect: WireDialect,
  apiIsOpenAiCompletions: boolean,
): { reasoningEfforts: Record<string, string | null>; compat?: { thinkingFormat?: string; supportsReasoningEffort?: boolean } } {
  switch (dialect) {
    case 'effort':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { supportsReasoningEffort: true } } : {}),
      }
    case 'deepseek':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'deepseek', supportsReasoningEffort: true } } : {}),
      }
    case 'openrouter':
      return {
        reasoningEfforts: { ...WIRE, off: 'none' },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'openrouter' } } : {}),
      }
    case 'together':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'together', supportsReasoningEffort: true } } : {}),
      }
    case 'zai':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'zai', supportsReasoningEffort: true } } : {}),
      }
    case 'qwen':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'qwen' } } : {}),
      }
    case 'string-thinking':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'string-thinking' } } : {}),
      }
    case 'ant-ling':
      return {
        reasoningEfforts: { ...WIRE },
        ...(apiIsOpenAiCompletions ? { compat: { thinkingFormat: 'ant-ling' } } : {}),
      }
  }
}

/**
 * 方言适用性备注（P3-2）：线方言的 compat（真正把档位翻译成线上字段的配置）
 * 只注入给显式声明 openai-completions 协议的路由/模型——其余协议由 pi-ai 内建
 * 翻译，方言配置不参与线上。debugReport 明细据此在行内注明这一事实，直接回答
 * 「我配了方言为什么没效果」。只陈述插件做了什么、方言何时才生效，不猜测端点
 * 行为——误导性的「配错了」结论会让用户把正确的配置改错（评估报告 P3-2 取舍）。
 */
export function dialectAppliesNote(api: string | undefined): string | undefined {
  if (api === 'openai-completions') return undefined
  return api === undefined
    ? 'note: wire dialect not applied — compat needs an explicit api=openai-completions declaration (none found)'
    : `note: wire dialect not applied — compat needs api=openai-completions, this model runs api=${api}`
}

export interface PiAiProfile {
  api?: string
  models?: Array<{ id: string; reasoningEfforts?: unknown; compat?: unknown }>
  modelOverrides?: Record<string, { reasoningEfforts?: unknown; compat?: unknown }>
}

/** settings.mutate 的路径操作（数组下标按服务要求传字符串）。 */
export type PathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** JSON 语义深比较（宿主 index.ts 的快照一致性校验也复用）。 */
export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((entry, index) => deepEqualJson(entry, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => key in right && deepEqualJson(left[key], right[key]))
}

/** 判断一个 reasoningEfforts 值是否与我们任一方言的注入一致（即由本插件写入）。 */
export function isOurInjection(reasoningEfforts: unknown): boolean {
  if (reasoningEfforts === null || typeof reasoningEfforts !== 'object') return false
  return DIALECT_KEYS.some((dialect) =>
    deepEqualJson(reasoningEfforts, wireFor(dialect, true).reasoningEfforts)
  )
}

/** 供给明细（debugReport）里一条决策的动作——write 之外的取值都是跳过原因。 */
export type ProvisionAction =
  | 'write'
  | 'skip-user-false'
  | 'skip-user-custom'
  | 'skip-native-reasoning'
  | 'skip-current'
  | 'skip-empty'

/** 供给决策明细的一条记录（debugReport 开启时逐条输出到宿主日志）。 */
export interface ProvisionDecision {
  route: string
  /** 模型 id；路由级条目（整条路由无可供给的模型）缺省。 */
  model?: string
  dialect: WireDialect
  /** 解析到的线上协议（路由/模型声明了 api 时携带）。 */
  api?: string
  action: ProvisionAction
  /** action === 'write' 时实际会写入的字段。 */
  fields?: Array<'reasoningEfforts' | 'compat'>
}

/** injectedModels 的模型级决策回调（调用方负责补 route/dialect 上下文）。 */
export type InjectedModelDecision = (
  modelId: string,
  action: 'write' | 'skip-user-false' | 'skip-user-custom' | 'skip-current',
  fields?: Array<'reasoningEfforts' | 'compat'>,
  api?: string,
) => void

/**
 * 为显式 models 数组计算注入后的完整条目，供「整数组替换」使用。
 * dsh-settings 的 path 补丁不能穿过数组中间节点（applyPathOp 会把数组
 * 当作非 plain object 重建为对象、丢失其余条目），所以对 models 只能
 * 一次性 replace 整个数组，而不是逐条写 models[i].reasoningEfforts。
 * @param onDecision - 逐模型决策回调（debugReport 明细的数据源），缺省不产出。
 * @returns 注入后的完整 models 数组，以及是否发生了任何变化。
 */
export function injectedModels(
  profile: PiAiProfile,
  dialect: WireDialect,
  apiOf: (modelId: string) => string | undefined,
  onDecision?: InjectedModelDecision,
): { models: Array<Record<string, unknown>>; changed: boolean } {
  const models = profile.models ?? []
  let changed = false
  const next = models.map((entry) => {
    const result: Record<string, unknown> = { ...(entry as Record<string, unknown>) }
    // 用户显式声明（false 或自定义字典）一律尊重，原样保留。
    if (entry.reasoningEfforts === false) {
      onDecision?.(entry.id, 'skip-user-false')
      return result
    }
    if (entry.reasoningEfforts !== undefined && !isOurInjection(entry.reasoningEfforts)) {
      onDecision?.(entry.id, 'skip-user-custom')
      return result
    }
    const api = apiOf(entry.id) ?? profile.api
    const injection = wireFor(dialect, api === 'openai-completions')
    const fields: Array<'reasoningEfforts' | 'compat'> = []
    if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
      result.reasoningEfforts = injection.reasoningEfforts
      changed = true
      fields.push('reasoningEfforts')
    }
    if (injection.compat !== undefined) {
      const compat = (entry.compat ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(injection.compat)) {
        if (compat[key] !== value) patch[key] = value
      }
      if (Object.keys(patch).length > 0) {
        result.compat = { ...compat, ...patch }
        changed = true
        fields.push('compat')
      }
    }
    onDecision?.(entry.id, fields.length > 0 ? 'write' : 'skip-current', fields.length > 0 ? fields : undefined, api)
    return result
  })
  return { models: next, changed }
}

/**
 * 为一条 route 生成供给补丁（幂等）：
 * - models 数组条目：reasoningEfforts 缺失或由我们注入（方言变更时改写）→ 按当前方言注入；
 *   用户显式声明（false 或自定义字典）→ 尊重并跳过；
 * - 纯目录路由（无 models 列表）→ 对缺少声明的目录模型写 modelOverrides。
 * @param route - 提供方路由名。
 * @param profile - pi-ai 设置里该路由的 profile。
 * @param dialect - 生效方言（路由覆盖 > 全局默认）。
 * @param apiOf - 取模型线上协议的解析器（未知返回 undefined，此时不注入 compat）。
 * @param catalogIds - 纯目录路由的目录模型 id 列表（仅无 models 时使用）。
 * @param hasNativeReasoning - 判断某模型是否已有原生 reasoning 元数据（目录模型用）。
 * @param onDecision - 逐模型决策回调（debugReport 明细的数据源），缺省不产出。
 */
export async function buildProvisionOps(
  route: string,
  profile: PiAiProfile,
  dialect: WireDialect,
  apiOf: (modelId: string) => string | undefined,
  catalogIds: string[] = [],
  hasNativeReasoning: (modelId: string) => boolean = () => false,
  onDecision?: (decision: ProvisionDecision) => void,
): Promise<PathOp[]> {
  const ops: PathOp[] = []
  /** 把模型级决策包上 route/dialect 上下文交给明细回调。 */
  const emitDecision: InjectedModelDecision = (modelId, action, fields, api) => {
    onDecision?.({ route, model: modelId, dialect, api, action, fields })
  }
  const pushFor = (basePath: string[], entry: { id: string; reasoningEfforts?: unknown; compat?: unknown }): void => {
    if (entry.reasoningEfforts === false) {
      emitDecision(entry.id, 'skip-user-false')
      return
    }
    if (entry.reasoningEfforts !== undefined && !isOurInjection(entry.reasoningEfforts)) {
      emitDecision(entry.id, 'skip-user-custom')
      return
    }
    const api = apiOf(entry.id) ?? profile.api
    const injection = wireFor(dialect, api === 'openai-completions')
    const fields: Array<'reasoningEfforts' | 'compat'> = []
    if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
      ops.push({ op: 'set', path: [...basePath, 'reasoningEfforts'], value: injection.reasoningEfforts })
      fields.push('reasoningEfforts')
    }
    if (injection.compat !== undefined) {
      const compat = (entry.compat ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(injection.compat)) {
        if (compat[key] !== value) patch[key] = value
      }
      if (Object.keys(patch).length > 0) {
        ops.push({ op: 'set', path: [...basePath, 'compat'], value: { ...compat, ...patch } })
        fields.push('compat')
      }
    }
    emitDecision(entry.id, fields.length > 0 ? 'write' : 'skip-current', fields.length > 0 ? fields : undefined, api)
  }
  const models = profile.models
  if (models !== undefined && models.length > 0) {
    // models 是数组：path 补丁穿不过数组中间节点，改为整数组替换。
    const { models: nextModels, changed } = injectedModels(profile, dialect, apiOf, emitDecision)
    if (changed) {
      ops.push({ op: 'set', path: ['providers', route, 'models'], value: nextModels })
    }
    return ops
  }
  // 纯目录路由：走 modelOverrides（仅目录模型可用，且需目录描述该路由）
  if (catalogIds.length === 0) return ops
  const overrides = profile.modelOverrides ?? {}
  for (const id of catalogIds) {
    if (hasNativeReasoning(id)) {
      onDecision?.({ route, model: id, dialect, action: 'skip-native-reasoning' })
      continue
    }
    const entry: { id: string; reasoningEfforts?: unknown; compat?: unknown } = { id, ...(overrides[id] ?? {}) }
    pushFor(['providers', route, 'modelOverrides', id], entry)
  }
  return ops
}