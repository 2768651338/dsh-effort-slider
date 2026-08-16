/**
 * 宿主侧纯逻辑单测（node 原生类型剥离直接导入 TS 源码）。
 * 运行：node test/host.spec.mjs
 */
import {
  DIALECT_KEYS,
  buildProvisionOps,
  isOurInjection,
  universalReasoning,
  wireFor,
} from '../src/effort-core.ts'

let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}
const json = (v) => JSON.stringify(v)

// ---- universalReasoning ----
const u = universalReasoning('off')
assert(json(u.efforts.map((e) => e.id)) === json(['off', 'low', 'medium', 'high', 'max']), 'universal ids are off/low/medium/high/max')
assert(u.efforts[u.efforts.length - 1].name === 'Ultracode', 'max level is named Ultracode')
assert(u.defaultEffort === 'off', 'default effort off')

// ---- wireFor dialects ----
assert(json(wireFor('effort', true)) === json({ reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' }, compat: { supportsReasoningEffort: true } }), 'effort dialect: verbatim levels + supportsReasoningEffort')
assert(wireFor('effort', false).compat === undefined, 'effort dialect: no compat on non-openai-completions')
assert(json(wireFor('deepseek', true).compat) === json({ thinkingFormat: 'deepseek', supportsReasoningEffort: true }), 'deepseek dialect compat')
assert(wireFor('openrouter', true).reasoningEfforts.off === 'none', 'openrouter off maps to none')
assert(json(wireFor('qwen', true).compat) === json({ thinkingFormat: 'qwen' }), 'qwen dialect compat')
assert(DIALECT_KEYS.length === 8, '8 dialects')

// ---- buildProvisionOps: models array ----
const profile = { models: [{ id: 'm1' }, { id: 'm2', reasoningEfforts: false }, { id: 'm3', reasoningEfforts: { off: null, low: 'x' } }] }
const ops = await buildProvisionOps('rt', profile, 'effort', (id) => id === 'm1' ? 'openai-completions' : undefined)
const paths = ops.map((o) => o.path.join('/'))
assert(paths.length === 1 && paths[0] === 'providers/rt/models', 'models branch emits ONE whole-array set op (path has no array index)')
const injected = ops[0].value
assert(Array.isArray(injected) && injected.length === 3, 'whole-array value keeps all 3 entries')
assert(injected[0].reasoningEfforts !== undefined && injected[0].reasoningEfforts.max === 'max', 'm1 got reasoningEfforts injected')
assert(injected[0].compat?.supportsReasoningEffort === true, 'm1 got compat on openai-completions')
assert(injected[1].reasoningEfforts === false, 'm2 (user false) kept untouched')
assert(injected[2].reasoningEfforts.off === null && injected[2].reasoningEfforts.low === 'x', 'm3 (user dict) kept untouched')

// ---- buildProvisionOps: catalog route via modelOverrides ----
const ops2 = await buildProvisionOps('rt2', { modelOverrides: { a: {} } }, 'deepseek', () => 'openai-completions', ['a', 'b'], (id) => id === 'b')
const paths2 = ops2.map((o) => o.path.join('/'))
assert(paths2.includes('providers/rt2/modelOverrides/a/reasoningEfforts') && paths2.includes('providers/rt2/modelOverrides/a/compat'), 'catalog model a overridden')
assert(!paths2.some((p) => p.includes('modelOverrides/b')), 'catalog model b (native reasoning) skipped')
assert(json(ops2.find((o) => o.path.at(-1) === 'compat').value) === json({ thinkingFormat: 'deepseek', supportsReasoningEffort: true }), 'override compat deepseek')

// ---- idempotency: no ops when already provisioned ----
const already = { models: [{ id: 'm1', reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' }, compat: { supportsReasoningEffort: true } }] }
const ops3 = await buildProvisionOps('rt', already, 'effort', () => 'openai-completions')
assert(ops3.length === 0, 'already-provisioned entry yields no ops')

// ---- dialect change rewrites our injection only ----
const ops4 = await buildProvisionOps('rt', already, 'deepseek', () => 'openai-completions')
assert(ops4.length === 1, 'dialect change writes one whole-array op (wire map identical, compat differs)')
assert(ops4[0].path.at(-1) === 'models', 'whole-array op targets models')
const m1 = ops4[0].value[0]
assert(m1.compat.thinkingFormat === 'deepseek' && m1.compat.supportsReasoningEffort === true, 'compat updated to deepseek')

// ---- isOurInjection ----
assert(isOurInjection({ off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' }) === true, 'recognizes own injection')
assert(isOurInjection({ off: null, low: 'x' }) === false, 'user dict not ours')
assert(isOurInjection(false) === false && isOurInjection(undefined) === false, 'false/undefined not ours')

console.log(failures === 0 ? 'ALL HOST SPECS PASSED' : failures + ' SPEC(S) FAILED')
process.exit(failures === 0 ? 0 : 1)