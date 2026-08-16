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
const WIRE: Record<string, Record<string, string | null>> = {
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

export interface PiAiProfile {
  api?: string
  models?: Array<{ id: string; reasoningEfforts?: unknown }>
  modelOverrides?: Record<string, { reasoningEfforts?: unknown }>
}

/** settings.mutate 的路径操作（数组下标按服务要求传字符串）。 */
export interface PathOp {
  op: 'set' | 'unset'
  path: string[]
  value?: unknown
}

function deepEqualJson(a: unknown, b: unknown): boolean {
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
 */
export async function buildProvisionOps(
  route: string,
  profile: PiAiProfile,
  dialect: WireDialect,
  apiOf: (modelId: string) => string | undefined,
  catalogIds: string[] = [],
  hasNativeReasoning: (modelId: string) => boolean = () => false,
): Promise<PathOp[]> {
  const ops: PathOp[] = []
  const pushFor = (basePath: string[], entry: { id: string; reasoningEfforts?: unknown; compat?: unknown }): void => {
    if (entry.reasoningEfforts === false) return
    if (entry.reasoningEfforts !== undefined && !isOurInjection(entry.reasoningEfforts)) return
    const api = apiOf(entry.id) ?? profile.api
    const injection = wireFor(dialect, api === 'openai-completions')
    if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
      ops.push({ op: 'set', path: [...basePath, 'reasoningEfforts'], value: injection.reasoningEfforts })
    }
    if (injection.compat !== undefined) {
      const compat = (entry.compat ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(injection.compat)) {
        if (compat[key] !== value) patch[key] = value
      }
      if (Object.keys(patch).length > 0) {
        ops.push({ op: 'set', path: [...basePath, 'compat'], value: { ...compat, ...patch } })
      }
    }
  }
  const models = profile.models
  if (models !== undefined && models.length > 0) {
    models.forEach((entry, index) => pushFor(['providers', route, 'models', String(index)], entry))
    return ops
  }
  // 纯目录路由：走 modelOverrides（仅目录模型可用，且需目录描述该路由）
  if (catalogIds.length === 0) return ops
  const overrides = profile.modelOverrides ?? {}
  for (const id of catalogIds) {
    if (hasNativeReasoning(id)) continue
    const entry: { id: string; reasoningEfforts?: unknown; compat?: unknown } = { id, ...(overrides[id] ?? {}) }
    pushFor(['providers', route, 'modelOverrides', id], entry)
  }
  return ops
}