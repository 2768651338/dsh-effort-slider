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
  listModels: async () => [],
  resolveModelInfo: async () => ({}),
  listConfigurableProviders: () => [],
}

// ---- mock cordis ctx ----
const listeners = {}
const disposers = []
const ctx = {
  get: (name) => (name === 'llm' ? llm : name === 'settings' ? settings : undefined),
  on: (ev, fn) => { listeners[ev] = fn },
  effect: (fn, label) => { disposers.push(fn()) },
  logger: { info() {}, warn() {}, error() {} },
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

console.log(failures === 0 ? 'ALL HOST APPLY SPECS PASSED' : failures + ' CHECK(S) FAILED')
if (failures > 0) process.exit(1)
