/**
 * 宿主半区「真实接缝」集成测试：真 cordis 上下文 + 真 @deepseek-ai/dsh-settings
 * 提供方（dsh-settings-file，落盘到临时 settings.yaml）。
 *
 * 与 test/host-apply.spec.mjs（纯 mock）互补：这里验证的是真实实现的行为——
 * 1. `settings.installSection(ctx, ns, schema, entry, hooks)` 真的注册成功，
 *    并且我们捕获到的 setting 段就是 schema 解析后的值；
 * 2. `settings.mutate('llm-pi-ai', ops)` 真的把整条 models 数组（v0.2.5 的
 *    整数组替换修复）写进 YAML，其它模型条目与字段不被破坏；
 * 3. 写入结果能通过 pi-ai 对 reasoningEfforts / compat 的校验规则
 *    （规则按 @deepseek-ai/dsh-llm-pi-ai 0.1.5-rc.1 的实现逐条复刻）；
 * 4. 重复触发 llm/adapters-updated 是幂等的，不会产生新的写入。
 *
 * 运行：node test/host-integration.spec.mjs
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}
const settle = async (ms = 120) => { await new Promise((resolve) => setTimeout(resolve, ms)) }

// ---- pi-ai 0.1.5-rc.1 的 reasoningEfforts 校验规则（逐条复刻）----
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

// ---- 1. 真 settings 提供方，落在工作区内的临时文档上 ----
const dir = await mkdtemp(join(tmpdir(), 'effort-slider-'))
const settingsPath = join(dir, 'settings.json')
console.log('# settings document:', settingsPath)

const root = new Context()
await root.plugin(FileSettingsProvider, { path: settingsPath, watch: false })
assert(root.get('settings') !== undefined, 'real FileSettingsProvider mounted as ctx.settings')

// ---- 2. 桩 llm 服务（0.1.5 的公开面只有 listModels / resolveModelInfo）----
const listed = ['gpt-4o', 'claude-3']
root.provide('llm', {
  listModels: async () => listed.map((id) => ({ provider: 'gateway', id, name: id })),
  resolveModelInfo: async (_provider, model) => ({ provider: 'gateway', id: model, name: model }),
})
assert(root.get('llm') !== undefined, 'stub llm service provided')

// ---- 3. 假 pi-ai：注册 llm-pi-ai 段，模拟「先 adapter 后 installSection」的时序 ----
const piAiEntry = {
  providers: {
    gateway: {
      api: 'openai-completions',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'claude-3', name: 'Claude 3' },
      ],
    },
  },
}
const fakePiAi = {
  name: 'fake-pi-ai',
  inject: ['settings'],
  apply(scope) {
    let current = () => piAiEntry
    scope.settings.installSection(scope, 'llm-pi-ai', z.object({
      providers: z.dict(z.object({
        api: z.string(),
        models: z.array(z.object({ id: z.string(), name: z.string() })),
      })).default({}),
    }), piAiEntry, {
      setSource: (source) => { current = source },
      onChange: () => {},
    })
  },
}
await root.plugin(fakePiAi)
await settle()
assert(root.settings.get('llm-pi-ai') !== undefined, 'fake pi-ai section registered before our plugin')

// ---- 4. 挂载被测插件 ----
const mod = await import('../lib/index.js')
await root.plugin({ name: mod.name, inject: mod.inject, apply: mod.apply })
await settle(400)

// ---- 5. 真实落盘结果 ----
const written = await readFile(settingsPath, 'utf8')
const doc = JSON.parse(written)
assert(doc['llm-pi-ai'] !== undefined, 'llm-pi-ai section present in the written document')
assert(doc['effort-slider'] === undefined, 'registering the effort-slider namespace writes nothing to the document')

const models = doc['llm-pi-ai']?.providers?.gateway?.models
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

// ---- 6. 设置段基座：effort-slider 段已注册，schema 默认值可用 ----
const effortSection = root.settings.get('effort-slider')
assert(effortSection?.enabled === true, 'effort-slider section resolves enabled=true from the schema default')
assert(effortSection?.defaultDialect === 'effort', 'effort-slider section resolves defaultDialect=effort')
assert(JSON.stringify(effortSection?.routes) === '{}', 'effort-slider section resolves routes={}')

// ---- 7. 幂等：再触发一次 adapters-updated，文档不应变化 ----
const before = await readFile(settingsPath, 'utf8')
root.emit('llm/adapters-updated')
await settle(300)
const after = await readFile(settingsPath, 'utf8')
assert(before === after, 'second provisioning pass is idempotent (document unchanged)')

// ---- 8. 用户显式声明的 reasoningEfforts 永不被覆盖 ----
await root.settings.update('llm-pi-ai', { providers: { gateway: { api: 'openai-completions', models: [{ id: 'custom', name: 'Custom', reasoningEfforts: false }] } } })
await settle(300)
const doc2 = JSON.parse(await readFile(settingsPath, 'utf8'))
const custom = doc2['llm-pi-ai']?.providers?.gateway?.models?.[0]
assert(custom?.reasoningEfforts === false, 'user-declared reasoningEfforts:false is respected and not overwritten')

await root.stop?.()
await rm(dir, { recursive: true, force: true })

console.log(failures === 0 ? 'ALL HOST INTEGRATION SPECS PASSED' : failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)
