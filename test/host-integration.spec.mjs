/**
 * 宿主半区「真实接缝」集成测试（适配 DSH 0.2.0）：真 cordis 上下文 +
 * 忠实仿真 0.2.0 SettingsForms 接缝的设置基座（0.2.0 移除了独立 settings
 * 文档与 dsh-settings-file，设置即 profile 条目配置，npm 上没有可独立
 * 挂载的官方实现，因此按其公开契约复刻：describe() / mutate() /
 * settings/document-updated / 条目 id 即命名空间）。
 *
 * 与 test/host-apply.spec.mjs（纯 mock，无 cordis）互补：这里验证的是
 * 插件在真实 cordis 装配下的行为——
 * 1. pi-ai 条目晚于本插件挂载时，供给延迟重试并最终落地；
 * 2. `settings.mutate('llm-pi-ai', ops)` 真的把整条 models 数组写进条目
 *    配置，其它模型条目与字段不被破坏；
 * 3. 写入结果能通过 pi-ai 对 reasoningEfforts / compat 的校验规则
 *    （规则按 @deepseek-ai/dsh-llm-pi-ai 0.2.0-rc.2 的实现逐条复刻）；
 * 4. 重复触发 llm/adapters-updated / settings/document-updated 是幂等的；
 * 5. 本插件条目配置（enabled=false）能关停后续供给。
 *
 * 运行：node test/host-integration.spec.mjs
 */
import { Context } from '@deepseek-ai/cordis'
let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}
const settle = async (ms = 120) => { await new Promise((resolve) => setTimeout(resolve, ms)) }

// ---- pi-ai 0.2.0-rc.2 的 reasoningEfforts 校验规则（逐条复刻）----
const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
/** openai-completions 协议能读到的 compat 开关。 */
const OPENAI_COMPLETIONS_SWITCHES = new Set(['thinkingFormat', 'supportsReasoningEffort'])
/**
 * 复刻 resolveModelReasoning 的拒绝条件。
 * @returns 'reasoning' | 'non-reasoning'，非法时抛错。
 */
function piAiValidateReasoningEfforts(efforts, id) {
  if (efforts === false) return 'non-reasoning'
  if (efforts === null || efforts === undefined || Object.keys(efforts).length === 0) {
    throw new Error(`model "${id}" has an empty reasoningEfforts`)
  }
  const declared = THINKING_LEVELS.filter((level) => efforts[level] !== undefined)
  for (const level of declared) {
    const wire = efforts[level]
    if (wire === null) {
      if (level !== 'off') throw new Error(`model "${id}" reasoningEfforts.${level} needs a wire value`)
    } else if (typeof wire !== 'string' || wire.length === 0) {
      throw new Error(`model "${id}" reasoningEfforts.${level} must not be empty`)
    }
  }
  if (!declared.some((level) => level !== 'off')) {
    throw new Error(`model "${id}" reasoningEfforts offers no level beyond "off"`)
  }
  return 'reasoning'
}

// ---- 0.2.0 SettingsForms 接缝仿真 ----
const root = new Context()
/** 条目 id → 用户补丁层（profile patch）。 */
const userLayers = new Map()
/** 条目 id → 修订号。 */
const revisions = new Map()
const documentUpdates = []
function entryValue(ns) {
  const user = userLayers.get(ns)
  if (ns === 'llm-pi-ai') {
    return { providers: user?.providers ?? {} }
  }
  return user ?? {}
}
const fakeSettings = {
  describe() {
    return [...userLayers.keys()].map((ns) => ({
      ns,
      autoGenerate: ns !== 'llm-pi-ai',
      schema: {},
      value: entryValue(ns),
      revision: revisions.get(ns) ?? 0,
      applies: 'live',
      secrets: [],
    }))
  },
  async mutate(ns, ops) {
    if (!userLayers.has(ns)) userLayers.set(ns, {})
    const section = userLayers.get(ns)
    for (const op of ops) {
      if (op.op === 'set') {
        let node = section
        for (let i = 0; i < op.path.length - 1; i++) {
          const key = op.path[i]
          if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
          node = node[key]
        }
        node[op.path[op.path.length - 1]] = structuredClone(op.value)
      } else if (op.op === 'unset') {
        let node = section
        for (let i = 0; i < op.path.length - 1; i++) {
          node = node?.[op.path[i]]
          if (node === undefined || node === null) break
        }
        if (node !== undefined && node !== null) delete node[op.path[op.path.length - 1]]
      }
    }
    revisions.set(ns, (revisions.get(ns) ?? 0) + 1)
    documentUpdates.push({ ns, revision: revisions.get(ns) })
    root.emit('settings/document-updated', ns, revisions.get(ns))
  },
}
root.provide('settings', fakeSettings)
assert(root.get('settings') !== undefined, '0.2.0 SettingsForms seam mounted as ctx.settings')

// ---- 桩 llm 服务（0.2.0 公开面：listModels / resolveModelInfo / 可配置提供方目录）----
const listed = ['gpt-4o', 'claude-3']
root.provide('llm', {
  listModels: async () => listed.map((id) => ({ provider: 'gateway', id, name: id })),
  resolveModelInfo: async (_provider, model) => ({ provider: 'gateway', id: model, name: model }),
  listConfigurableProviders: () => [],
})
assert(root.get('llm') !== undefined, 'stub llm service provided')

// ---- 假 pi-ai：条目晚于本插件挂载（loader 逐条目装配的时序）----
const fakePiAi = {
  name: 'fake-pi-ai',
  inject: ['settings'],
  apply(scope) {
    setTimeout(() => {
      userLayers.set('llm-pi-ai', {
        providers: {
          gateway: {
            api: 'openai-completions',
            models: [
              { id: 'gpt-4o', name: 'GPT-4o' },
              { id: 'claude-3', name: 'Claude 3' },
            ],
          },
        },
      })
      root.emit('llm/adapters-updated')
    }, 80)
    scope.effect(() => () => {})
  },
}
await root.plugin(fakePiAi)

// ---- 挂载被测插件 ----
const mod = await import('../lib/index.js')
assert(mod.Config !== undefined && (typeof mod.Config === 'object' || typeof mod.Config === 'function'), 'plugin exports Config (schemastery schema, 0.2.0 settings-form source)')
await root.plugin({ name: mod.name, inject: mod.inject, apply: mod.apply, Config: mod.Config })
await settle(900)

// ---- 1. 条目就绪后供给落地 ----
assert(userLayers.has('llm-pi-ai'), 'pi-ai entry registered by the fake loader')
const doc = userLayers.get('llm-pi-ai')
assert(doc?.providers?.gateway !== undefined, 'llm-pi-ai entry carries the gateway provider')
assert(userLayers.get('ui-effort-slider') === undefined, 'our plugin writes no config of its own')

const models = doc?.providers?.gateway?.models
assert(Array.isArray(models) && models.length === 2, 'whole-array write keeps both model entries')
assert(models?.[0].name === 'GPT-4o' && models?.[1].name === 'Claude 3', 'sibling fields survive the whole-array replacement')

const first = models?.[0]
assert(first?.reasoningEfforts?.off === null, 'reasoningEfforts.off is null (send nothing)')
assert(first?.reasoningEfforts?.low === 'low' && first?.reasoningEfforts?.medium === 'medium', 'low/medium wire spellings written')
assert(first?.reasoningEfforts?.high === 'high' && first?.reasoningEfforts?.max === 'max', 'high/max wire spellings written')
assert(Object.keys(first?.reasoningEfforts ?? {}).length === 5, 'exactly the universal five levels declared')

// pi-ai 会拒绝的写法在这里必须不出现
let accepted = null
try {
  accepted = piAiValidateReasoningEfforts(first?.reasoningEfforts, first?.id)
} catch (error) {
  accepted = `rejected: ${error.message}`
}
assert(accepted === 'reasoning', `written reasoningEfforts passes pi-ai validation (${accepted})`)
assert(first?.reasoningEfforts?.max === 'max', 'max level is one of pi-ai THINKING_LEVELS')

assert(first?.compat?.supportsReasoningEffort === true, 'model-level compat written for the openai-completions route')
const compatKeys = Object.keys(first?.compat ?? {})
assert(compatKeys.every((key) => OPENAI_COMPLETIONS_SWITCHES.has(key)), `compat only carries openai-completions switches (${compatKeys.join(', ')})`)
assert(models?.[1]?.reasoningEfforts?.max === 'max', 'second model provisioned too')

// ---- 2. 幂等：重复触发两条事件，用户层不再变化 ----
const before = JSON.stringify(userLayers.get('llm-pi-ai'))
const writesBefore = documentUpdates.filter((u) => u.ns === 'llm-pi-ai').length
root.emit('llm/adapters-updated')
await settle(300)
root.emit('settings/document-updated', 'llm-pi-ai', revisions.get('llm-pi-ai') ?? 0)
await settle(300)
const after = JSON.stringify(userLayers.get('llm-pi-ai'))
assert(before === after, 'second provisioning pass is idempotent (user layer unchanged)')
const writesAfter = documentUpdates.filter((u) => u.ns === 'llm-pi-ai').length
assert(writesAfter === writesBefore, `document-updated echo settles without new writes (${writesBefore} → ${writesAfter})`)

// ---- 3. 用户显式声明的 reasoningEfforts 永不被覆盖 ----
await fakeSettings.mutate('llm-pi-ai', [{
  op: 'set',
  path: ['providers', 'gateway', 'models'],
  value: [{ id: 'custom', name: 'Custom', reasoningEfforts: false }],
}])
await settle(300)
const doc2 = userLayers.get('llm-pi-ai')
const custom = doc2?.providers?.gateway?.models?.[0]
assert(custom?.reasoningEfforts === false, 'user-declared reasoningEfforts:false is respected and not overwritten')

// ---- 4. 本插件条目配置：enabled=false 关停后续供给 ----
await root.dispose?.()
const root2 = new Context()
userLayers.clear()
documentUpdates.length = 0
root2.provide('settings', fakeSettings)
root2.provide('llm', {
  listModels: async () => [],
  resolveModelInfo: async () => ({}),
  listConfigurableProviders: () => [],
})
userLayers.set('llm-pi-ai', {
  providers: { gateway: { api: 'openai-completions', models: [{ id: 'm-2', name: 'M2' }] } },
})
const mod2 = await import('../lib/index.js')
await root2.plugin({
  name: mod2.name,
  inject: mod2.inject,
  Config: mod2.Config,
  apply: (ctx, config) => mod2.apply(ctx, { ...config, enabled: false }),
})
await settle(700)
assert(userLayers.get('llm-pi-ai')?.providers?.gateway?.models?.[0]?.reasoningEfforts === undefined, 'enabled=false stops provisioning (model left untouched)')

await root2.dispose?.()

console.log(failures === 0 ? 'ALL HOST INTEGRATION SPECS PASSED' : failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)
