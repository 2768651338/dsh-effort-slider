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
/**
* 方言适用性备注（P3-2）：线方言的 compat（真正把档位翻译成线上字段的配置）
* 只注入给显式声明 openai-completions 协议的路由/模型——其余协议由 pi-ai 内建
* 翻译，方言配置不参与线上。debugReport 明细据此在行内注明这一事实，直接回答
* 「我配了方言为什么没效果」。只陈述插件做了什么、方言何时才生效，不猜测端点
* 行为——误导性的「配错了」结论会让用户把正确的配置改错（评估报告 P3-2 取舍）。
*/
function dialectAppliesNote(api) {
	if (api === "openai-completions") return void 0;
	return api === void 0 ? "note: wire dialect not applied — compat needs an explicit api=openai-completions declaration (none found)" : `note: wire dialect not applied — compat needs api=openai-completions, this model runs api=${api}`;
}
/** JSON 语义深比较（宿主 index.ts 的快照一致性校验也复用）。 */
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
* @param onDecision - 逐模型决策回调（debugReport 明细的数据源），缺省不产出。
* @returns 注入后的完整 models 数组，以及是否发生了任何变化。
*/
function injectedModels(profile, dialect, apiOf, onDecision) {
	const models = profile.models ?? [];
	let changed = false;
	return {
		models: models.map((entry) => {
			const result = { ...entry };
			if (entry.reasoningEfforts === false) {
				onDecision?.(entry.id, "skip-user-false");
				return result;
			}
			if (entry.reasoningEfforts !== void 0 && !isOurInjection(entry.reasoningEfforts)) {
				onDecision?.(entry.id, "skip-user-custom");
				return result;
			}
			const api = apiOf(entry.id) ?? profile.api;
			const injection = wireFor(dialect, api === "openai-completions");
			const fields = [];
			if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
				result.reasoningEfforts = injection.reasoningEfforts;
				changed = true;
				fields.push("reasoningEfforts");
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
					fields.push("compat");
				}
			}
			onDecision?.(entry.id, fields.length > 0 ? "write" : "skip-current", fields.length > 0 ? fields : void 0, api);
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
* @param onDecision - 逐模型决策回调（debugReport 明细的数据源），缺省不产出。
*/
async function buildProvisionOps(route, profile, dialect, apiOf, catalogIds = [], hasNativeReasoning = () => false, onDecision) {
	const ops = [];
	/** 把模型级决策包上 route/dialect 上下文交给明细回调。 */
	const emitDecision = (modelId, action, fields, api) => {
		onDecision?.({
			route,
			model: modelId,
			dialect,
			api,
			action,
			fields
		});
	};
	const pushFor = (basePath, entry) => {
		if (entry.reasoningEfforts === false) {
			emitDecision(entry.id, "skip-user-false");
			return;
		}
		if (entry.reasoningEfforts !== void 0 && !isOurInjection(entry.reasoningEfforts)) {
			emitDecision(entry.id, "skip-user-custom");
			return;
		}
		const api = apiOf(entry.id) ?? profile.api;
		const injection = wireFor(dialect, api === "openai-completions");
		const fields = [];
		if (!deepEqualJson(entry.reasoningEfforts, injection.reasoningEfforts)) {
			ops.push({
				op: "set",
				path: [...basePath, "reasoningEfforts"],
				value: injection.reasoningEfforts
			});
			fields.push("reasoningEfforts");
		}
		if (injection.compat !== void 0) {
			const compat = entry.compat ?? {};
			const patch = {};
			for (const [key, value] of Object.entries(injection.compat)) if (compat[key] !== value) patch[key] = value;
			if (Object.keys(patch).length > 0) {
				ops.push({
					op: "set",
					path: [...basePath, "compat"],
					value: {
						...compat,
						...patch
					}
				});
				fields.push("compat");
			}
		}
		emitDecision(entry.id, fields.length > 0 ? "write" : "skip-current", fields.length > 0 ? fields : void 0, api);
	};
	const models = profile.models;
	if (models !== void 0 && models.length > 0) {
		const { models: nextModels, changed } = injectedModels(profile, dialect, apiOf, emitDecision);
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
		if (hasNativeReasoning(id)) {
			onDecision?.({
				route,
				model: id,
				dialect,
				action: "skip-native-reasoning"
			});
			continue;
		}
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
/** 注入的宿主服务：llm（模型目录查询）、settings（profile 条目配置表单）。 */
const inject = ["llm", "settings"];
/**
* 本插件条目配置（DSH 0.2.0 设置页由插件导出的 Config 自动生成；
* 变更按 cordis 语义重启本插件，供给幂等因此无需热更新钩子）。
*/
const Config = z.object({
	enabled: z.boolean().default(true),
	defaultDialect: z.union(DIALECT_KEYS).default("effort"),
	routes: z.dict(z.union(DIALECT_KEYS)).default({}),
	debugReport: z.boolean().default(false)
});
/** pi-ai 条目 id 的默认值（pi-ai 0.2.0 的 NS 常量；仅当条目被改名时失配）。 */
const PI_AI_DEFAULT_NS = "llm-pi-ai";
/** 判断一个条目 resolved value 是否是 pi-ai 形状（顶层 providers 对象）。 */
function isPiAiValue(value) {
	if (typeof value !== "object" || value === null) return false;
	const providers = value.providers;
	return typeof providers === "object" && providers !== null;
}
/**
* 应用宿主半区：pi-ai 线级供给。
* @param ctx - cordis 宿主上下文。
* @param config - 本插件条目配置（patch base / 设置页补丁解析后的值）。
*/
function apply(ctx, config) {
	const cfg = {
		enabled: true,
		defaultDialect: "effort",
		routes: {},
		debugReport: false,
		...config
	};
	const llm = ctx.get("llm");
	const settings = ctx.get("settings");
	if (llm === void 0 || settings === void 0) {
		ctx.logger.warn("effort-slider: llm/settings service unavailable — host provisioning disabled");
		return;
	}
	const forms = () => {
		try {
			return settings.describe() ?? [];
		} catch {
			return [];
		}
	};
	/**
	* 定位 pi-ai 条目 id。优先按约定 id 直配；失配（条目被改名）时用 llm 的
	* 可配置提供方目录交叉定位——pi-ai 目录条目携带它自己的 settingsNs。
	*/
	let piAiNs;
	const findPiAiNs = () => {
		const all = forms();
		const direct = all.find((form) => form.ns === PI_AI_DEFAULT_NS);
		if (direct !== void 0 && isPiAiValue(direct.value)) return direct.ns;
		let directoryNs;
		try {
			directoryNs = new Set(llm.listConfigurableProviders().map((entry) => entry.settingsNs));
		} catch {
			directoryNs = void 0;
		}
		for (const form of all) if (directoryNs?.has(form.ns) === true && isPiAiValue(form.value)) return form.ns;
	};
	let retryTimer = null;
	let retryCount = 0;
	let retryExhaustedWarned = false;
	const RETRY_MAX = 60;
	const scheduleRetry = () => {
		if (retryTimer !== null) return;
		if (retryCount >= RETRY_MAX) {
			if (!retryExhaustedWarned) {
				retryExhaustedWarned = true;
				ctx.logger.warn(`effort-slider: pi-ai entry not mounted after ${RETRY_MAX} retries (30s) — provisioning paused until the next trigger event`);
			}
			return;
		}
		retryTimer = setTimeout(() => {
			retryTimer = null;
			retryCount += 1;
			if (findPiAiNs() !== void 0) {
				retryCount = 0;
				retryExhaustedWarned = false;
				provision();
				return;
			}
			scheduleRetry();
		}, 500);
	};
	const nativeReasoning = /* @__PURE__ */ new Map();
	const hasNativeReasoning = async (route, modelId) => {
		const key = `${route}\u0000${modelId}`;
		const memo = nativeReasoning.get(key);
		if (memo !== void 0) return memo;
		try {
			const result = (await llm.resolveModelInfo(route, modelId))?.reasoning !== void 0;
			nativeReasoning.set(key, result);
			return result;
		} catch (error) {
			ctx.logger.warn(`effort-slider: resolveModelInfo(${route}, ${modelId}) failed — treated as no native reasoning for this round`);
			ctx.logger.warn(error);
			return false;
		}
	};
	const SKIP_REASONS = {
		"skip-user-false": "user-declared reasoningEfforts:false kept untouched",
		"skip-user-custom": "user-declared custom dictionary kept untouched",
		"skip-native-reasoning": "native reasoning already declared",
		"skip-current": "already current for this dialect",
		"skip-empty": "no models declared and no catalog models"
	};
	const describeDecision = (d) => {
		const where = d.model === void 0 ? `route "${d.route}"` : `route "${d.route}" model "${d.model}"`;
		const api = d.api === void 0 ? "" : ` api=${d.api}`;
		const action = d.action === "write" ? `write ${d.fields?.join(" + ") ?? "(nothing)"}` : `skip: ${SKIP_REASONS[d.action]}`;
		const note = d.action === "write" || d.action === "skip-current" ? dialectAppliesNote(d.api) : void 0;
		return `${where} dialect=${d.dialect}${api} → ${action}${note === void 0 ? "" : ` ${note}`}`;
	};
	const emitDebugReport = (report, opCount) => {
		ctx.logger.info(`effort-slider: [debug] provisioning report — ${report.length} decision(s), ${opCount} field op(s)`);
		for (const d of report) ctx.logger.info(`effort-slider: [debug] ${describeDecision(d)}`);
	};
	const runProvision = async () => {
		if (!cfg.enabled) return true;
		const targetNs = findPiAiNs();
		if (targetNs === void 0) {
			scheduleRetry();
			return false;
		}
		piAiNs = targetNs;
		retryCount = 0;
		retryExhaustedWarned = false;
		const entry = forms().find((form) => form.ns === targetNs);
		const providers = isPiAiValue(entry?.value) ? (entry?.value).providers : void 0;
		if (providers === void 0 || Object.keys(providers).length === 0) return true;
		const ops = [];
		const report = [];
		const onDecision = cfg.debugReport ? (decision) => {
			report.push(decision);
		} : void 0;
		for (const [route, profile] of Object.entries(providers)) {
			const dialect = cfg.routes[route] ?? cfg.defaultDialect;
			const apiOf = () => profile.api;
			const models = profile.models;
			let catalogIds = [];
			if (models === void 0 || models.length === 0) try {
				catalogIds = (await llm.listModels(route)).map((entryModel) => entryModel.id).filter((id) => typeof id === "string" && id.length > 0);
			} catch (error) {
				ctx.logger.warn(`effort-slider: listModels failed for route "${route}" — catalog route skipped this round`);
				ctx.logger.warn(error);
				catalogIds = [];
			}
			const decisionsBefore = report.length;
			let newOps;
			if (catalogIds.length > 0) {
				const nativeIds = /* @__PURE__ */ new Set();
				for (const id of catalogIds) if (await hasNativeReasoning(route, id)) nativeIds.add(id);
				newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds, (id) => nativeIds.has(id), onDecision);
			} else newOps = await buildProvisionOps(route, profile, dialect, apiOf, catalogIds, void 0, onDecision);
			ops.push(...newOps);
			if (cfg.debugReport && report.length === decisionsBefore) report.push({
				route,
				dialect,
				action: "skip-empty"
			});
		}
		if (ops.length === 0) {
			if (cfg.debugReport) emitDebugReport(report, 0);
			return true;
		}
		const reread = forms().find((form) => form.ns === targetNs);
		if (!(entry !== void 0 && reread !== void 0 && (typeof entry.revision === "number" && typeof reread.revision === "number" ? reread.revision === entry.revision : deepEqualJson(entry.value, reread.value)))) {
			ctx.logger.info("effort-slider: pi-ai entry changed during provisioning — deferring to the newer edit");
			return true;
		}
		if (cfg.debugReport) emitDebugReport(report, ops.length);
		else ctx.logger.info(`effort-slider: provisioning ${ops.length} field(s) across pi-ai models`);
		try {
			await settings.mutate(targetNs, ops);
			nativeReasoning.clear();
		} catch (error) {
			ctx.logger.warn("effort-slider: pi-ai entry mutate refused");
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
	ctx.on("llm/adapters-updated", () => {
		provision();
	});
	ctx.on("settings/document-updated", (ns) => {
		if (typeof ns === "string" && ns === piAiNs) provision();
	});
	if (cfg.debugReport) ctx.on("llm/stream", (options, next) => {
		const purpose = options.purpose === void 0 ? "" : ` purpose=${options.purpose}`;
		ctx.logger.info(`effort-slider: [debug] request route=${options.provider} model=${options.model} effort=${options.reasoningEffort ?? "(none)"}${purpose}`);
		return next();
	});
	provision();
	ctx.effect(() => () => {
		if (retryTimer !== null) clearTimeout(retryTimer);
		retryTimer = null;
	}, "ui-effort-slider: provisioning retry cleanup");
}
//#endregion
export { Config, apply, inject, name };
