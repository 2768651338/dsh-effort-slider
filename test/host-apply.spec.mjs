/**
 * 宿主 apply 集成测试（适配 DSH 0.2.0 的 SettingsForms 接缝：设置即 profile
 * 条目配置，describe() 读、mutate() 写、settings/document-updated 通知）。
 *
 * 关键回归 1：pi-ai 条目晚于本插件挂载（describe() 先无该条目）时，供给
 *   必须能延迟重试并最终落地（否则任何自定义模型都无思考强度）。
 * 关键回归 2：模型级 compat 只对声明了 openai-completions 的路由注入，
 *   未声明 api 的路由只注入 reasoningEfforts（pi-ai 会拒绝协议读不到的开关）。
 * 关键回归 3：settings/document-updated 只对 pi-ai 条目触发复判，且幂等。
 * 运行：node test/host-apply.spec.mjs
 */

let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}

// ---- mock setTimeout（捕获回调 + 延迟，供手动快进）----
const timers = []
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length }
globalThis.clearTimeout = () => {}
const flush = async (n = 20) => { for (let i = 0; i < n; i++) await Promise.resolve() }

// ---- 可切换的 pi-ai 条目（0.2.0：条目 id 即设置命名空间）----
let piAiPresent = false
const piAiEntry = {
  providers: {
    // 声明了协议：应同时注入 reasoningEfforts 与模型级 compat
    jiyuanlvdong: {
      api: 'openai-completions',
      models: [
        { id: 'gpt-4o' },
        { id: 'claude-3' },
      ],
    },
    // 未声明协议：只注入 reasoningEfforts（compat 会被 pi-ai 拒绝）
    gateway: {
      models: [{ id: 'm-1' }],
    },
    // 纯目录路由（无 models 列表）：供给走 listModels + modelOverrides
    catalogFail: {},
  },
}
const mutations = []
/** 极简 path-op 落地器：模拟真实 mutate 后 resolved value 立即可见。 */
const applyOps = (doc, ops) => {
  for (const op of ops) {
    if (op.op !== 'set') continue
    let node = doc
    for (let i = 0; i < op.path.length - 1; i++) {
      if (typeof node[op.path[i]] !== 'object' || node[op.path[i]] === null) node[op.path[i]] = {}
      node = node[op.path[i]]
    }
    node[op.path[op.path.length - 1]] = op.value
  }
}
const settings = {
  describe: () => (piAiPresent ? [{ ns: 'llm-pi-ai', value: piAiEntry, revision: 1 }] : []),
  mutate: async (ns, ops) => {
    mutations.push({ ns, ops })
    if (ns === 'llm-pi-ai') applyOps(piAiEntry, ops)
  },
}

// ---- mock llm（0.2.0 公开面：listModels / resolveModelInfo / 可配置提供方目录）----
const llm = {
  listModels: async () => { throw new Error('network down') },
  resolveModelInfo: async () => ({}),
  listConfigurableProviders: () => [],
}

// ---- mock cordis ctx ----
const listeners = {}
const disposers = []
const logInfo = []
const logWarn = []
const ctx = {
  get: (name) => (name === 'llm' ? llm : name === 'settings' ? settings : undefined),
  on: (ev, fn) => { listeners[ev] = fn },
  effect: (fn, label) => { disposers.push(fn()) },
  logger: { info: (m) => logInfo.push(String(m)), warn: (m) => logWarn.push(String(m)), error: () => {} },
}

// ---- 加载宿主产物 ----
const mod = await import('../lib/index.js')
assert(typeof mod.apply === 'function', 'host apply exported')
assert(JSON.stringify(mod.inject) === JSON.stringify(['llm', 'settings']), 'host inject = [llm, settings]')
assert(mod.Config !== undefined && (typeof mod.Config === 'object' || typeof mod.Config === 'function'), 'host exports Config (schemastery schema, 0.2.0 settings form source)')

// ---- apply：pi-ai 条目尚未挂载 ----
mod.apply(ctx, {})
await flush()
assert(piAiPresent === false, 'precondition: pi-ai entry unmounted at apply time')
assert(timers.length > 0, 'provision scheduled a retry while pi-ai entry is unready')

// ---- pi-ai 条目挂载（模拟 loader 装配完成）----
piAiPresent = true

// ---- 快进一个重试周期 ----
for (const t of timers.slice()) t.fn()
await flush()

const piAiMutations = mutations.filter((m) => m.ns === 'llm-pi-ai')
assert(piAiMutations.length > 0, 'provision mutated the llm-pi-ai entry after it became ready')
if (piAiMutations.length > 0) {
  const allOps = piAiMutations.flatMap((m) => m.ops)
  const byPath = new Map(allOps.map((op) => [op.path.join('/'), op.value]))
  assert(allOps.length === 2, 'provision emits one whole-array set op per route with explicit models')

  const declared = byPath.get('providers/jiyuanlvdong/models')
  assert(Array.isArray(declared) && declared.length === 2, 'declared-api route: whole-array value keeps both models')
  assert(declared?.[0].reasoningEfforts?.off === null && declared?.[0].reasoningEfforts?.max === 'max', 'model 0 got reasoningEfforts (off→null, max→max)')
  assert(declared?.[1].reasoningEfforts !== undefined, 'model 1 got reasoningEfforts')
  assert(declared?.[0].compat?.supportsReasoningEffort === true, 'declared-api route: compat.supportsReasoningEffort true on effort dialect')

  const undeclared = byPath.get('providers/gateway/models')
  assert(Array.isArray(undeclared) && undeclared.length === 1, 'undeclared-api route: whole-array value keeps its model')
  assert(undeclared?.[0].reasoningEfforts !== undefined, 'undeclared-api route still gets reasoningEfforts')
  assert(undeclared?.[0].compat === undefined, 'undeclared-api route gets NO compat (protocol unknown)')
}

// ---- P1-4：纯目录路由的 listModels 失败必须留下诊断日志，且不阻塞其他路由 ----
assert(logWarn.some((w) => w.includes('listModels') && w.includes('catalogFail')), 'listModels failure for a catalog route leaves a diagnostic warn (P1-4)')
assert(logWarn.every((w) => !w.includes('not mounted after')), 'no retry-exhaustion warn while provisioning eventually succeeds')

// ---- P3-1（debugReport 关）：保持原有的单行计数日志 ----
assert(logInfo.some((m) => m.includes('provisioning ') && m.includes('field(s) across pi-ai models')), 'debugReport off keeps the single-line provisioning count (P3-1)')
assert(logInfo.every((m) => !m.includes('[debug]')), 'no [debug] lines while debugReport is off (P3-1)')
// ---- P3-2（debugReport 关）：不挂 llm/stream 请求追踪器 ----
assert(listeners['llm/stream'] === undefined, 'no llm/stream request tracer while debugReport is off (P3-2)')

// ---- 幂等：已供给过的配置不再产生写入 ----
mutations.length = 0
listeners['llm/adapters-updated']?.()
await flush()
assert(mutations.length === 0, 'second provision pass via adapters-updated is idempotent (no writes)')

// ---- settings/document-updated：pi-ai 条目回声触发复判但不写入；无关条目不触发 ----
listeners['settings/document-updated']?.('llm-pi-ai', 2)
await flush()
assert(mutations.length === 0, 'document-updated echo for pi-ai entry does not rewrite (idempotent)')
listeners['settings/document-updated']?.('unrelated-entry', 7)
await flush()
assert(mutations.length === 0, 'document-updated for an unrelated entry does not trigger provisioning')

// ---- P3-1：debugReport 开启时输出逐模型明细，替代单行计数 ----
// 重置 pi-ai 条目为「未供给」形状：一个待注入模型 + 一个用户显式声明的模型；
// 另加两条 P3-2 对照路由——声明了非 openai-completions 协议的路由与未声明协议的路由，
// 它们的明细行必须注明「方言不作用于线上」。
piAiEntry.providers = {
  jiyuanlvdong: {
    api: 'openai-completions',
    models: [
      { id: 'gpt-4o' },
      { id: 'user-kept', reasoningEfforts: false },
    ],
  },
  anthropic: { api: 'anthropic-messages', models: [{ id: 'sonnet' }] },
  gateway: { models: [{ id: 'm-1' }] },
}
mutations.length = 0
const logInfo2 = []
const logWarn2 = []
const listeners2 = {}
const ctx2 = {
  get: (name) => (name === 'llm' ? llm : name === 'settings' ? settings : undefined),
  on: (ev, fn) => { listeners2[ev] = fn },
  effect: (fn) => { fn() },
  logger: { info: (m) => logInfo2.push(String(m)), warn: (m) => logWarn2.push(String(m)), error: () => {} },
}
mod.apply(ctx2, { debugReport: true })
await flush()
assert(mutations.some((m) => m.ops.length > 0), 'debugReport on: provisioning still writes (report replaces only the log line)')
const debugLines = logInfo2.filter((m) => m.includes('[debug]'))
assert(debugLines.length >= 2, 'debugReport on emits a header line plus per-model report lines (P3-1)')
assert(debugLines.some((m) => m.includes('jiyuanlvdong') && m.includes('gpt-4o') && m.includes('write reasoningEfforts + compat') && m.includes('api=openai-completions')), 'report line names route/model/resolved api/written fields (P3-1)')
assert(debugLines.some((m) => m.includes('user-kept') && m.includes('skip: user-declared')), 'report line explains the user-declared skip (P3-1)')
assert(logInfo2.every((m) => !m.includes('field(s) across pi-ai models')), 'single-line count is replaced while debugReport is on (P3-1)')

// ---- P3-2：明细行注明方言何时才作用于线上（compat 只对显式声明的 openai-completions）----
assert(debugLines.some((m) => m.includes('anthropic-messages') && m.includes('dialect not applied')), 'report line notes the dialect is not applied on a declared non-openai-completions api (P3-2)')
assert(debugLines.some((m) => m.includes('route "gateway"') && m.includes('none found')), 'report line notes the undeclared-api case (P3-2)')
const ocLine = debugLines.find((m) => m.includes('gpt-4o') && m.includes('write'))
assert(ocLine !== undefined && !ocLine.includes('dialect not applied'), 'openai-completions lines carry no dialect note (P3-2)')

// ---- P3-2：请求追踪（llm/stream 只读透传，仅 debugReport 开启时挂载）----
assert(typeof listeners2['llm/stream'] === 'function', 'debugReport on attaches an llm/stream request tracer (P3-2)')
const passthrough = Symbol('stream')
const traced = listeners2['llm/stream']({ provider: 'gateway', model: 'm-1', reasoningEffort: 'high' }, () => passthrough)
assert(traced === passthrough, 'tracer returns next() untouched (read-only passthrough)')
assert(logInfo2.some((m) => m.includes('[debug] request') && m.includes('route=gateway') && m.includes('model=m-1') && m.includes('effort=high')), 'tracer logs route/model/effort per request (P3-2)')
listeners2['llm/stream']({ provider: 'gateway', model: 'm-1', reasoningEffort: undefined, purpose: 'compaction' }, () => passthrough)
assert(logInfo2.some((m) => m.includes('effort=(none)') && m.includes('purpose=compaction')), 'tracer notes a missing effort and auxiliary purpose (P3-2)')

// 幂等复判：明细全部是 skip-current，且不再写入
logInfo2.length = 0
mutations.length = 0
listeners2['llm/adapters-updated']?.()
await flush()
assert(mutations.length === 0, 'debug idempotent round writes nothing')
assert(logInfo2.some((m) => m.includes('[debug]') && m.includes('already current')), 'idempotent debug round reports skip: already current (P3-1)')

console.log(failures === 0 ? 'ALL HOST APPLY SPECS PASSED' : failures + ' CHECK(S) FAILED')
if (failures > 0) process.exit(1)
