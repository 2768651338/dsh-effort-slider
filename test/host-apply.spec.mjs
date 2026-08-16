/**
 * 宿主 apply 集成测试：验证 pi-ai settings 段晚注册时的供给重试时序。
 * 关键回归：pi-ai 先 registerAdapter（emit llm/adapters-updated）后
 * installSettingsSection，且 register 不触发 settings/updated —— 供给在
 * 段就绪前空跑后必须能延迟重试并最终落地（否则任何自定义模型都无思考强度）。
 * 运行：node test/host-apply.spec.mjs
 */

let failures = 0
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
  else console.log('ok:', msg)
}

// ---- mock setTimeout（捕获回调 + 延迟，供手动快进）----
const timers = []
const realSetTimeout = globalThis.setTimeout
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length }
globalThis.clearTimeout = () => {}
const flush = async (n = 20) => { for (let i = 0; i < n; i++) await Promise.resolve() }

// ---- 可切换的 pi-ai settings 段 ----
let piAiSection = undefined
const mutations = []
const settings = {
  get: (ns) => (ns === 'llm-pi-ai' ? piAiSection : undefined),
  mutate: async (ns, ops) => { mutations.push({ ns, ops }) },
}

// ---- mock llm ----
const llm = {
  adapters: new Map(),
  listModels: async () => [],
  resolveModelInfo: async () => ({}),
}

// ---- mock cordis ctx ----
const listeners = {}
const disposers = []
const ctx = {
  get: (name) => (name === 'llm' ? llm : name === 'settings' ? settings : undefined),
  on: (ev, fn) => { listeners[ev] = fn },
  effect: (fn, label) => { disposers.push(fn()) },
  inject: (deps, cb) => {
    // installSettingsSection 会 inject ['settings']：返回一个极简 scope
    const sctx = {
      settings: {
        register: (ns, schema, opts) => ({
          get: () => opts.base,
          watch: () => () => {},
        }),
      },
      effect: (fn) => { disposers.push(fn()) },
    }
    cb(sctx)
  },
  logger: { info() {}, warn() {}, error() {} },
}

// ---- 加载宿主产物 ----
const mod = await import('../lib/index.js')
assert(typeof mod.apply === 'function', 'host apply exported')

// ---- apply：pi-ai 段尚未注册 ----
mod.apply(ctx, {})
await flush()
assert(piAiSection === undefined, 'precondition: pi-ai section unregistered at apply time')
assert(timers.length > 0, 'provision scheduled a retry while pi-ai section is unready')

// ---- pi-ai 段就绪（模拟 installSettingsSection 注册完成）----
piAiSection = {
  providers: {
    jiyuanlvdong: {
      api: 'openai-completions',
      models: [
        { id: 'gpt-4o' },
        { id: 'claude-3' },
      ],
    },
  },
}

// ---- 快进一个重试周期 ----
const before = timers.length
for (const t of timers.slice()) t.fn()
await flush()

const piAiMutations = mutations.filter((m) => m.ns === 'llm-pi-ai')
assert(piAiMutations.length > 0, 'provision mutated llm-pi-ai after section became ready')
if (piAiMutations.length > 0) {
  const allOps = piAiMutations.flatMap((m) => m.ops)
  const reasonOps = allOps.filter((op) => op.path[op.path.length - 1] === 'reasoningEfforts')
  assert(reasonOps.length === 2, 'both custom models got reasoningEfforts injected')
  const first = reasonOps[0]
  assert(first !== undefined && first.op === 'set' && first.value.off === null && first.value.max === 'max', 'injected reasoningEfforts maps off→null, max→max')
  const compatOps = allOps.filter((op) => op.path[op.path.length - 1] === 'compat')
  assert(compatOps.length === 2, 'openai-completions models got compat injected')
  assert(compatOps[0]?.value?.supportsReasoningEffort === true, 'compat.supportsReasoningEffort true on effort dialect')
}

console.log(failures === 0 ? 'ALL HOST APPLY SPECS PASSED' : failures + ' CHECK(S) FAILED')
if (failures > 0) process.exit(1)
