import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
//#region src/effort-core.ts
/**
* dsh-effort-slider 宿主侧纯逻辑（无外部依赖，便于单测）。
* 通用思考强度供给器：为任何缺少 reasoning 元数据的模型提供 5 档刻度，
* 并按线方言生成 pi-ai 可消费的 reasoningEfforts / compat 配置。
*/
/** 支持的自定义端点线方言。 */
const DIALECT_KEYS = [
	"effort",
	"deepseek",
	"openrouter",
	"together",
	"zai",
	"qwen",
	"string-thinking",
	"ant-ling"
];
/** 通用 reasoning 元数据（注入给未声明 reasoning 的适配器模型）。 */
function universalReasoning(defaultEffort = "off") {
	return {
		efforts: [
			{
				id: "off",
				name: "OFF"
			},
			{
				id: "low",
				name: "Low"
			},
			{
				id: "medium",
				name: "Medium"
			},
			{
				id: "high",
				name: "High"
			},
			{
				id: "max",
				name: "Ultracode"
			}
		],
		defaultEffort
	};
}
/**
* 每个线方言的线级映射：reasoningEfforts 字典（pi-ai THINKING_LEVELS 词汇），
* off 恒为 null（pi-ai 语义：声明支持、不发参数），其余档位为线上拼写。
*/
const WIRE = {
	off: null,
	low: "low",
	medium: "medium",
	high: "high",
	max: "max"
};
/**
* 计算一个模型按方言应注入的 pi-ai 配置。
* @param dialect - 线方言。
* @param apiIsOpenAiCompletions - 模型是否走 openai-completions 协议
*   （compat 开关只对该协议合法，其余协议仅注入 reasoningEfforts）。
*/
function wireFor(dialect, apiIsOpenAiCompletions) {
	switch (dialect) {
		case "effort": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: { supportsReasoningEffort: true } } : {}
		};
		case "deepseek": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: {
				thinkingFormat: "deepseek",
				supportsReasoningEffort: true
			} } : {}
		};
		case "openrouter": return {
			reasoningEfforts: {
				...WIRE,
				off: "none"
			},
			...apiIsOpenAiCompletions ? { compat: { thinkingFormat: "openrouter" } } : {}
		};
		case "together": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: {
				thinkingFormat: "together",
				supportsReasoningEffort: true
			} } : {}
		};
		case "zai": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: {
				thinkingFormat: "zai",
				supportsReasoningEffort: true
			} } : {}
		};
		case "qwen": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: { thinkingFormat: "qwen" } } : {}
		};
		case "string-thinking": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: { thinkingFormat: "string-thinking" } } : {}
		};
		case "ant-ling": return {
			reasoningEfforts: { ...WIRE },
			...apiIsOpenAiCompletions ? { compat: { thinkingFormat: "ant-ling" } } : {}
		};
	}
}
function deepEqualJson(a, b) {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((entry, index) => deepEqualJson(entry, b[index]));
	}
	const left = a;
	const right = b;
	const keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every((key) => key in right && deepEqualJson(left[key], right[key]));
}
/** 判断一个 reasoningEfforts 值是否与我们任一方言的注入一致（即由本插件写入）。 */
function isOurInjection(reasoningEfforts) {
	if (reasoningEfforts === null || typeof reasoningEfforts !== "object") return false;
	return DIALECT_KEYS.some((dialect) => deepEqualJson(reasoningEfforts, wireFor(dialect, true).reasoningEfforts));
}
/**
* 为显式 models 数组计算注入后的完整条目，供「整数组替换」使用。
* dsh-settings 的 path 补丁不能穿过数组中间节点（applyPathOp 会把数组
* 当作非 plain object 重建为对象、丢失其余条目），所以对 models 只能
* 一次性 replace 整个数组，而不是逐条写 models[i].reasoningEfforts。
* @returns 注入后的完整 models 数组，以及是否发生了任何变化。
*/
function injectedModels(profile, dialect, apiOf) {
	const models = profile.models ?? [];
	let changed = false;
	return {
		models: models.map((entry) => {
			const result = { ...entry };
			if (entry.reasoningEfforts === false) return result;
			if (entry.reasoningEfforts !== void 0 && !isOurInjection(entry.reasoningEfforts)) return result;
			const injection = wireFor(dialect, (apiOf(entry.id) ?? profile.api) === "openai-completions");
			if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
				result.reasoningEfforts = injection.reasoningEfforts;
				changed = true;
			}
			if (injection.compat !== void 0) {
				const compat = entry.compat ?? {};
				const patch = {};
				for (const [key, value] of Object.entries(injection.compat)) if (compat[key] !== value) patch[key] = value;
				if (Object.keys(patch).length > 0) {
					result.compat = {
						...compat,
						...patch
					};
					changed = true;
				}
			}
			return result;
		}),
		changed
	};
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
async function buildProvisionOps(route, profile, dialect, apiOf, catalogIds = [], hasNativeReasoning = () => false) {
	const ops = [];
	const pushFor = (basePath, entry) => {
		if (entry.reasoningEfforts === false) return;
		if (entry.reasoningEfforts !== void 0 && !isOurInjection(entry.reasoningEfforts)) return;
		const injection = wireFor(dialect, (apiOf(entry.id) ?? profile.api) === "openai-completions");
		if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) ops.push({
			op: "set",
			path: [...basePath, "reasoningEfforts"],
			value: injection.reasoningEfforts
		});
		if (injection.compat !== void 0) {
			const compat = entry.compat ?? {};
			const patch = {};
			for (const [key, value] of Object.entries(injection.compat)) if (compat[key] !== value) patch[key] = value;
			if (Object.keys(patch).length > 0) ops.push({
				op: "set",
				path: [...basePath, "compat"],
				value: {
					...compat,
					...patch
				}
			});
		}
	};
	const models = profile.models;
	if (models !== void 0 && models.length > 0) {
		const { models: nextModels, changed } = injectedModels(profile, dialect, apiOf);
		if (changed) ops.push({
			op: "set",
			path: [
				"providers",
				route,
				"models"
			],
			value: nextModels
		});
		return ops;
	}
	if (catalogIds.length === 0) return ops;
	const overrides = profile.modelOverrides ?? {};
	for (const id of catalogIds) {
		if (hasNativeReasoning(id)) continue;
		const entry = {
			id,
			...overrides[id] ?? {}
		};
		pushFor([
			"providers",
			route,
			"modelOverrides",
			id
		], entry);
	}
	return ops;
}
//#endregion
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-effort-slider";
/** 注入的宿主服务：llm（适配器注册表）、settings（设置段读写）。 */
const inject = ["llm", "settings"];
/** 本插件设置段命名空间。 */
const NS = settingsNamespace("effort-slider");
/** pi-ai 适配器的设置段命名空间（线级供给目标）。 */
const PI_AI_NS = settingsNamespace("llm-pi-ai");
const Config = z.object({
	enabled: z.boolean().default(true),
	defaultDialect: z.union(DIALECT_KEYS).default("effort"),
	routes: z.dict(z.union(DIALECT_KEYS)).default({})
});
/**
* 应用宿主半区：适配器元数据包装 + pi-ai 线级供给 + 设置段。
* @param ctx - cordis 宿主上下文。
* @param config - 插件行配置（作为设置段 base 层，可被用户设置覆盖）。
*/
function apply(ctx, config) {
	const base = {
		enabled: true,
		defaultDialect: "effort",
		routes: {},
		...config
	};
	let current = () => base;
	const options = () => current();
	const llm = ctx.get("llm");
	const settings = ctx.get("settings");
	if (llm === void 0 || settings === void 0) {
		ctx.logger.warn("effort-slider: llm/settings service unavailable — host provisioning disabled");
		return;
	}
	let retryTimer = null;
	let retryCount = 0;
	const RETRY_MAX = 60;
	const piAiReady = () => settings.get(PI_AI_NS) !== void 0;
	const wrapped = /* @__PURE__ */ new WeakSet();
	const piAiRoutes = () => {
		const section = settings.get(PI_AI_NS);
		return new Set(Object.keys(section?.providers ?? {}));
	};
	const wrapAdapter = (adapter) => {
		if (typeof adapter.resolveModel !== "function") return;
		const original = adapter.resolveModel.bind(adapter);
		adapter.resolveModel = async (provider, model, signal) => {
			const info = await original(provider, model, signal);
			if (info !== null && typeof info === "object" && info.reasoning === void 0) return {
				...info,
				reasoning: universalReasoning("off")
			};
			return info;
		};
	};
	const scheduleRetry = () => {
		if (retryTimer !== null || retryCount >= RETRY_MAX) return;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			retryCount += 1;
			if (piAiReady()) {
				retryCount = 0;
				wrapAdapters();
				provision();
				return;
			}
			scheduleRetry();
		}, 500);
	};
	const wrapAdapters = () => {
		if (!piAiReady()) {
			scheduleRetry();
			return;
		}
		const piRoutes = piAiRoutes();
		for (const [provider, registration] of llm.adapters) {
			if (piRoutes.has(provider)) continue;
			const adapter = registration.adapter;
			if (wrapped.has(adapter)) continue;
			wrapped.add(adapter);
			wrapAdapter(adapter);
		}
	};
	const apiResolverFor = (route) => {
		const adapter = llm.adapters.get(route)?.adapter;
		return (modelId) => {
			try {
				return adapter?.current?.()?.models?.getModel?.(route, modelId)?.api;
			} catch {
				return;
			}
		};
	};
	const nativeReasoning = /* @__PURE__ */ new Map();
	const hasNativeReasoning = async (route, modelId) => {
		const key = `${route}\u0000${modelId}`;
		const memo = nativeReasoning.get(key);
		if (memo !== void 0) return memo;
		let result = false;
		try {
			result = (await llm.resolveModelInfo(route, modelId))?.reasoning !== void 0;
		} catch {
			result = false;
		}
		nativeReasoning.set(key, result);
		return result;
	};
	const runProvision = async () => {
		const cfg = options();
		if (!cfg.enabled) return true;
		const section = settings.get(PI_AI_NS);
		if (section === void 0) {
			scheduleRetry();
			return false;
		}
		const providers = section?.providers;
		if (providers === void 0 || Object.keys(providers).length === 0) return true;
		const ops = [];
		for (const [route, profile] of Object.entries(providers)) {
			const dialect = cfg.routes[route] ?? cfg.defaultDialect;
			const apiOf = apiResolverFor(route);
			const models = profile.models;
			let catalogIds = [];
			if (models === void 0 || models.length === 0) try {
				catalogIds = (await llm.listModels(route)).map((entry) => typeof entry === "string" ? entry : entry.id).filter((id) => typeof id === "string" && id.length > 0);
			} catch {
				catalogIds = [];
			}
			const newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds, (modelId) => false);
			if (catalogIds.length > 0) {
				const nativeIds = /* @__PURE__ */ new Set();
				for (const id of catalogIds) if (await hasNativeReasoning(route, id)) nativeIds.add(id);
				ops.push(...newOps.filter((op) => {
					const marker = op.path.indexOf("modelOverrides");
					if (marker < 0) return true;
					const modelId = op.path[marker + 1];
					return modelId !== void 0 && !nativeIds.has(modelId);
				}));
			} else ops.push(...newOps);
		}
		if (ops.length === 0) return true;
		ctx.logger.info(`effort-slider: provisioning ${ops.length} field(s) across pi-ai models`);
		try {
			await settings.mutate(PI_AI_NS, ops);
		} catch (error) {
			ctx.logger.warn("effort-slider: pi-ai settings mutate refused");
			ctx.logger.warn(error);
		}
		return true;
	};
	let provisionTail = Promise.resolve();
	let queued = false;
	const provision = () => {
		queued = true;
		provisionTail = provisionTail.then(async () => {
			if (!queued) return;
			queued = false;
			await runProvision();
		}).catch((error) => {
			queued = false;
			ctx.logger.warn("effort-slider: provisioning failed");
			ctx.logger.warn(error);
		});
		return provisionTail;
	};
	installSettingsSection(ctx, NS, Config, base, {
		setSource: (source) => {
			current = source;
		},
		onChange: () => {
			provision();
		}
	});
	ctx.on("llm/adapters-updated", () => {
		wrapAdapters();
		provision();
	});
	ctx.on("settings/updated", (ns) => {
		if (ns === PI_AI_NS) provision();
	});
	wrapAdapters();
	provision();
	ctx.effect(() => () => {
		if (retryTimer !== null) clearTimeout(retryTimer);
		retryTimer = null;
	}, "ui-effort-slider: provisioning retry cleanup");
}
//#endregion
export { apply, inject, name };
