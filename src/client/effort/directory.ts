/**
 * 客户端目录服务的最小结构面 —— 本插件只依赖这些成员，不 import 任何
 * DSH 运行时包（纯类型 import 会在打包时被擦除，因此客户端产物没有
 * DSH 模块请求，无需 dsh.client.external）。
 *
 * 0.1.5 起，模型目录与档位写入不再走 `connection.api.sessions.models/selectModel`
 * 这两个直连 RPC（ConnectionHandle 已不暴露 `.api`），而是走
 * `ctx.modelDirectories`（ModelDirectoryResolver）暴露的每会话共享目录：
 * 同一个 store 同时驱动 /model 弹层与输入框上方的模型座位，写入走
 * `directory.select(...)`。0.2.0 该面保持不变（store/load/select 同形）。
 */

/** 一档推理等级（宿主目录返回的 effort 条目）。 */
export interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** 目录里的一个模型。 */
export interface DirectoryModel {
  id: string
  name?: string
  /** 适配器声明的可选推理档位；缺失表示该模型没有原生多档推理。 */
  reasoning?: {
    efforts?: readonly EffortLevel[]
    defaultEffort?: string
  }
}

/** 一个提供方分组。 */
export interface DirectoryGroup {
  id: string
  name?: string
  models: readonly DirectoryModel[]
}

/** 一次完整的模型 + 档位选择。 */
export interface DirectorySelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** 目录快照（ModelDirectoryState 的结构子集）。 */
export interface DirectoryState {
  /** 生效选择：会话投影或宿主默认值。 */
  current: DirectorySelection | null
  /** 已加载的提供方分组。 */
  groups: readonly DirectoryGroup[]
  /** 进行中的操作生命周期。 */
  status?: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  /** 整请求或选择失败的文案。 */
  error?: string | null
}

/** 一个会话的共享目录。 */
export interface ModelDirectoryLike {
  readonly store: {
    getSnapshot(): DirectoryState
    subscribe(listener: () => void): () => void
  }
  /** 确保宿主目录已加载。 */
  load(): Promise<unknown>
  /** 提交 provider/model/reasoningEffort 选择。 */
  select(selection: DirectorySelection): Promise<void>
}

/** `ctx.modelDirectories`。 */
export interface ModelDirectoriesLike {
  directoryFor(sessionId: string): ModelDirectoryLike
}

/** 会话目录里的一行（SessionSummary 的结构子集）。 */
export interface SessionRowLike {
  id?: string
  /** 本地持有计数；0.2.0 的 mainView 计数 > 0 即当前主视图会话。 */
  retainedBy?: Partial<Record<string, number | undefined>>
}

/** 会话目录快照（SessionListState 的结构子集，兼容 0.1.x / 0.2.0）。 */
export interface SessionListLike {
  /** 0.1.x 直出的当前会话 id；0.2.0 起移除。 */
  current?: string
  /** 0.2.0 的目录行（键为会话 id）。 */
  byId?: Record<string, SessionRowLike>
}

/** `ctx.sessions`（只用到当前会话 id）。 */
export interface SessionsLike {
  readonly list: { getSnapshot(): SessionListLike }
}

/**
 * 解析当前主视图会话 id。0.1.x 直接读 `list.current`；0.2.0 该字段移除
 * （「导航归视图所有」），官方 uiSession 以 `retainedBy.mainView > 0`
 * 判定当前会话，这里跟随同一判定，并保留旧字段兜底。
 */
export function currentSessionId(sessions: SessionsLike): string | undefined {
  let snapshot: SessionListLike
  try {
    snapshot = sessions.list.getSnapshot()
  } catch {
    return undefined
  }
  const direct = snapshot.current
  if (typeof direct === 'string' && direct.length > 0) return direct
  for (const [key, row] of Object.entries(snapshot.byId ?? {})) {
    if ((row?.retainedBy?.mainView ?? 0) > 0) {
      return typeof row?.id === 'string' && row.id.length > 0 ? row.id : key
    }
  }
  return undefined
}

/** 安全读取目录快照：目录可能尚未装配完整。 */
export function snapshotOf(directory: ModelDirectoryLike): DirectoryState | null {
  try {
    return directory.store.getSnapshot() ?? null
  } catch {
    return null
  }
}
