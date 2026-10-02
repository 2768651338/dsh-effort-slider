/**
 * 仿 Claude Code 推理等级 Effort 面板 —— 参考 EffortCard 的 1:1 移植（辉光边框、
 * 渐变卡片、Easy/Intense 刻度标签、WebGL 火焰轨道、发光滑块、拖拽点光源）。
 * 点击官方模型菜单的「推理等级」行时弹出本面板（替代官方档位列表）；
 * 拖动过程连续无级，松手时吸附到最近的档位。
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useWebglFire } from './useWebglFire.ts'
import { snapshotOf, type DirectorySelection, type DirectoryState, type EffortLevel, type ModelDirectoryLike } from './directory.ts'
import { PANEL_W, THUMB_W } from './metrics.ts'
import css from './effort.module.css'

/** Panel props: owning session, the session's shared model directory, close verb. */
export interface EffortPanelProps {
  sessionId: string
  directory: ModelDirectoryLike
  onClose: () => void
  /** 档位变化回调：面板外层用它给模型菜单行的档位文字着色。 */
  onEffortChange?: (effortId: string) => void
}

/** 通用兜底刻度（与宿主侧 effort-core 的 universalReasoning 保持一致）。 */
const UNIVERSAL_EFFORTS: EffortLevel[] = [
  { id: 'off', name: 'OFF' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'max', name: 'Ultracode' },
]

/** 档位显示名：off → OFF、max → Ultracode，其余用目录名。 */
const displayName = (level: EffortLevel): string =>
  level.id === 'off' ? 'OFF' : level.id === 'max' ? 'Ultracode' : level.name

/** 写入失败态在 header 状态文字上的停留时长（之后自动恢复常规档位文字）。 */
const WRITE_ERROR_VISIBLE_MS = 2000

/**
 * 面板用户可见文案（最小双语文案表）。菜单行识别对中英文都兼容，但面板自己的
 * 提示必须二选一渲染：按 DSH 界面语言（<html lang>，退回 navigator）取一套，
 * 不引入 i18n 框架——对插件体量是过度设计。
 */
const STRINGS = {
  zh: {
    close: '关闭',
    writeFailed: '写入失败',
    loadFailed: '模型目录加载失败',
    retry: '重试',
    loading: '模型目录加载中…',
    unsupported: '当前模型不支持思考强度调节',
    unsupportedHint: '若为自定义模型：请检查插件的 enabled 与方言配置；开启 debugReport 可在宿主日志查看供给明细',
    slider: '思考强度',
    help: '排查帮助',
    // {route} 会替换为当前模型所在路由（routes.<路由>）；路由未知时回退为 routes。
    helpHint: '拖动了但模型思考行为没变？可能是线方言没配对：在插件设置检查 {route} 或 defaultDialect（对照 README 方言表）；开启 debugReport 可在宿主日志核对插件写入了什么、请求携带了哪档。',
  },
  en: {
    close: 'Close',
    writeFailed: 'Write failed',
    loadFailed: 'Failed to load model directory',
    retry: 'Retry',
    loading: 'Loading model directory…',
    unsupported: 'This model doesn\u2019t support effort adjustment',
    unsupportedHint: 'For a custom model, check the plugin\u2019s enabled & dialect config; enable debugReport for a provisioning report in the host log',
    slider: 'Reasoning effort',
    help: 'Troubleshooting',
    helpHint: 'Dragged but the model\u2019s thinking didn\u2019t change? The wire dialect may be wrong: check {route} or defaultDialect in the plugin settings (see the README dialect table); enable debugReport to verify in the host log what the plugin wrote and which effort requests carry.',
  },
} as const

/** 界面语言探测：文档语言优先（DSH 在 <html lang> 带界面语言），退回 navigator。 */
const isZhUi = (): boolean => {
  const lang = (document.documentElement?.lang || navigator.language || '').trim()
  return /^zh([_-]|$)/i.test(lang)
}

/**
 * 订阅会话共享目录（与 /model 弹层、模型座位同一份状态）。
 * 打开面板时先读一次快照，再订阅后续变化，并触发一次 load()。
 * load() 被拒时记录到面板本地（宿主 store 未必会把失败上抛到快照里，
 * 必须独立兜底），reload() 重新发起一次 load()。
 * @param directory - 会话的共享目录。
 * @returns 目录快照、面板自身的 load 失败标记与重试入口。
 */
function useDirectory(directory: ModelDirectoryLike): {
  state: DirectoryState | null
  loadFailed: boolean
  reload: () => void
} {
  const [state, setState] = useState<DirectoryState | null>(() => snapshotOf(directory))
  const [loadFailed, setLoadFailed] = useState(false)
  // 重试 = 递增 attempt 重跑 effect；失败标记随 effect 重建一并复位。
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const read = (): void => {
      if (alive) setState(snapshotOf(directory))
    }
    read()
    setLoadFailed(false)
    const stop = directory.store.subscribe(read)
    let pending: Promise<unknown>
    try {
      pending = Promise.resolve(directory.load())
    } catch (error) {
      pending = Promise.reject(error)
    }
    void pending.then(read, (error: unknown) => {
      console.warn('[effort-slider] directory load failed:', error)
      if (alive) setLoadFailed(true)
    })
    return () => {
      alive = false
      stop()
    }
  }, [directory, attempt])

  const reload = useCallback((): void => setAttempt((n) => n + 1), [])
  return { state, loadFailed, reload }
}

/**
 * The floating effort card.
 * @param props - session + shared directory + close verb.
 */
export function EffortPanel(props: EffortPanelProps): ReactElement {
  const { sessionId, directory, onClose, onEffortChange } = props
  // 按界面语言取文案（每次渲染读取一次，语言切换后面板重开即生效）。
  const t = STRINGS[isZhUi() ? 'zh' : 'en']
  const { state, loadFailed, reload } = useDirectory(directory)
  const [dragging, setDragging] = useState(false)
  // 「拖动无效」排查提示的开合（P3-2）：? 按钮切换，tooltip 覆盖在轨道上方，
  // 不挤压面板布局。
  const [helpOpen, setHelpOpen] = useState(false)
  // 最近一次写入被目录拒绝时的短暂错误态（header 状态文字变红）。
  const [writeError, setWriteError] = useState(false)
  // 写入序号：只有「最新一笔」的失败才算数——拖动中连发多笔时，旧写入的
  // 迟到拒绝不得覆盖更新一笔已成功的事实。
  const writeSeqRef = useRef(0)
  const writeErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (writeErrorTimerRef.current !== null) clearTimeout(writeErrorTimerRef.current)
  }, [])
  // Continuous 0..100 slider position; snaps to an effort level on release.
  const [rawValue, setRawValue] = useState(0)

  const rawCurrent = state?.current ?? null
  // 无 current 时回退到第一个分组的第一模型（目录数据总是可用的）。
  const firstGroup = state?.groups[0]
  const fallback: DirectorySelection | null = firstGroup?.models[0] === undefined
    ? null
    : { provider: firstGroup.id, model: firstGroup.models[0].id }
  const current = rawCurrent ?? fallback
  const group = current === null ? undefined : state?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  // 目录未声明 reasoning 元数据时使用通用 5 档刻度（宿主侧会为自定义模型供给）
  const declaredEfforts = model?.reasoning?.efforts
  const efforts = declaredEfforts !== undefined && declaredEfforts.length > 0 ? declaredEfforts : UNIVERSAL_EFFORTS
  const usable = state !== null && current !== null && efforts.length >= 2

  // overlay 三分支：加载中 / 加载失败 / 确不支持——环境故障不得被翻译成
  // 「模型不支持」。status 缺失（旧形状快照）且 groups 为空时按加载中处理，
  // 宁可多显示一会儿加载中，也不误报「不支持」。
  const dirStatus = state?.status
  const dirErrored = loadFailed || dirStatus === 'error'
  const dirLoading = !dirErrored && (
    state === null
    || dirStatus === 'loading'
    || dirStatus === 'idle'
    || (dirStatus === undefined && (state?.groups.length ?? 0) === 0)
  )

  // 宿主 store 自行进入 error 时把原始错误带进 console（UI 只展示统一文案，
  // 不把目录服务的措辞直接推给用户）。
  const storeError = state?.status === 'error' ? state.error ?? '(no message)' : null
  useEffect(() => {
    if (storeError !== null) console.warn('[effort-slider] directory error:', storeError)
  }, [storeError])

  const currentEffortId = current?.reasoningEffort ?? model?.reasoning?.defaultEffort
  const rawIndex = currentEffortId === undefined ? -1 : efforts.findIndex((level) => level.id === currentEffortId)
  const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100
  const initialRaw = usable && rawIndex >= 0 ? rawIndex * step100 : 0

  // 拖动期间不自作主张地回写滑块位置：拖动中的每次写入都会让目录快照的
  // reasoningEffort 变化，若照单同步会把滑块从指针下抢走。因此只同步
  // 「不是本面板刚写出去、且与上次已同步值不同」的档位（官方入口或宿主
  // 改档位时仍然会同步过来）；松手时 commit 自己完成吸附。
  const writtenEffortRef = useRef<string | null>(null)
  const syncedEffortRef = useRef<string | null>(null)
  useEffect(() => {
    if (!usable || currentEffortId === undefined) return
    // 目录就绪后把当前档位上报给外层（供菜单行着色）。
    onEffortChange?.(currentEffortId)
    // 本面板刚写出去的档位：不回写滑块（否则会把滑块从指针下抢走）。
    if (writtenEffortRef.current === currentEffortId) return
    // 外部（官方入口 / 宿主）改过档位：撤掉「刚写出去」的标记，恢复正常同步。
    writtenEffortRef.current = null
    if (syncedEffortRef.current === currentEffortId) return
    syncedEffortRef.current = currentEffortId
    setRawValue(initialRaw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, usable, currentEffortId, initialRaw])

  const displayIndex = usable ? Math.round(rawValue / step100) : 0
  const level = efforts[displayIndex]
  const slider100 = usable ? rawValue : 0
  // 火焰前沿保底可见（最低档也有火苗，拖动时跟随滑块）。
  const slider01 = usable ? 0.15 + (rawValue / 100) * 0.85 : 0

  // WebGL fire: the front edge follows the slider; the CSS mask reveals it.
  // getActive 传 usable 而非恒 true：不可用时轨道已被 opacity 隐藏，循环在
  // MAX_IDLE 帧后休眠，恢复可用后由 per-render kick 重新点火。
  const fireRef = useRef<HTMLCanvasElement | null>(null)
  useWebglFire(fireRef, () => slider01, () => usable)

  const maskP = Math.max(slider100 - 1.5, 0)
  const maskFade = Math.min(slider100 + 1.5, 100)
  const fireStyle: React.CSSProperties = usable
    ? {
        maskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
        WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
        opacity: 1,
      }
    : { opacity: 0 }

  const pointLightStyle: React.CSSProperties = {
    left: `${22 + (slider100 / 100) * (PANEL_W - 44)}px`,
    top: '76px',
  }

  /** 写入当前档位到会话（供拖动中节流调用）。 */
  const writeEffort = (v: number): void => {
    if (!usable || current === null) return
    const idx = Math.round(v / step100)
    const effort = efforts[idx]
    if (effort === undefined) return
    writtenEffortRef.current = effort.id
    onEffortChange?.(effort.id)
    // 官方入口自己保留错误提示面，但面板是独立浮层、官方提示在面板打开期间
    // 未必可见——写入被拒必须在本面板有反馈，否则用户以为调成了实际没调成。
    const seq = ++writeSeqRef.current
    // 新一笔写入开始：上一笔的失败态就此过时。
    setWriteError(false)
    if (writeErrorTimerRef.current !== null) {
      clearTimeout(writeErrorTimerRef.current)
      writeErrorTimerRef.current = null
    }
    void directory.select({
      provider: current.provider,
      model: current.model,
      reasoningEffort: effort.id,
    }).catch((error: unknown) => {
      console.warn('[effort-slider] selectModel failed:', error)
      // 已被更新的写入取代：旧写入的迟到拒绝不再显示。
      if (seq !== writeSeqRef.current) return
      // 不回退滑块位置（用户可直接重拖）；header 状态文字短暂切换为错误态。
      setWriteError(true)
      writeErrorTimerRef.current = setTimeout(() => {
        writeErrorTimerRef.current = null
        setWriteError(false)
      }, WRITE_ERROR_VISIBLE_MS)
    })
  }
  const lastWriteRef = useRef(0)

  const onInput = (event: React.FormEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    setRawValue(v)
    // 每帧最多一次写入，避免拖动中请求堆积造成尾部延迟。
    const now = performance.now()
    if (now - lastWriteRef.current >= 16) {
      lastWriteRef.current = now
      writeEffort(v)
    }
  }

  /** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
  const commit = (event: React.SyntheticEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    const idx = Math.round(v / step100)
    setRawValue(idx * step100)
    setDragging(false)
    writeEffort(v)
  }

  // 面板/轨道的共享尺寸经自定义属性喂给 CSS（单一来源见 metrics.ts）。
  const panelVars = { '--effort-panel-w': `${PANEL_W}px` } as React.CSSProperties
  const trackVars = { '--effort-thumb-w': `${THUMB_W}px` } as React.CSSProperties
  // 排查提示（P3-2）点名当前模型所在路由；目录里是显示名还是路由 id 不完全
  // 可控，为空时回退为不带路由名的泛指，宁可含糊也不给错路由。
  const routeRef = current !== null && current.provider.length > 0 ? `routes.${current.provider}` : 'routes'
  const helpHintText = t.helpHint.replace('{route}', routeRef)
  /**
   * 刻度点/标签布点：原生 thumb 的行程是「半 thumb 宽 → 容器宽 - 半 thumb 宽」，
   * 两端各缩进 THUMB_W/2——按行程布点才能与滑块的实际吸附位置对齐，
   * 否则首尾档偏差约半个 thumb（P2-5）。
   */
  const levelPos = (index: number): string => {
    const ratio = index / Math.max(efforts.length - 1, 1)
    return `calc(${THUMB_W / 2}px + ${ratio.toFixed(4)} * (100% - ${THUMB_W}px))`
  }

  return (
    <div className={css.panel} style={panelVars} data-effort-panel="true" data-session={sessionId}>
      <div className={css.glow} />
      <div className={css.inner}>
        <div className={css.head}>
          <div className={css.headLeft}>
            <span className={css.labelText}>Effort</span>
            {usable && writeError ? (
              <span className={`${css.status} ${css.statusError}`}>{t.writeFailed}</span>
            ) : usable && level !== undefined ? (
              <span
                key={level.name}
                className={`${css.status} ${css[`level${displayIndex}`] ?? ''} ${displayIndex === efforts.length - 1 ? css.statusGlow : ''}`}
              >
                {displayName(level)}
              </span>
            ) : (
              <span className={css.status}>—</span>
            )}
          </div>
          <div className={css.headActions}>
            <button
              type="button"
              className={`${css.help}${helpOpen ? ` ${css.helpExpanded}` : ''}`}
              onClick={() => setHelpOpen((open) => !open)}
              aria-label={t.help}
              aria-expanded={helpOpen}
              {...(helpOpen ? { 'aria-controls': 'effort-help-hint' } : {})}
            >
              ?
            </button>
            <button type="button" className={css.close} onClick={onClose} aria-label={t.close}>
              ×
            </button>
          </div>
        </div>
        {/* P3-2：方言配错的表现和「模型不支持」一样静默——在滑杆可用的常态下
            也给一条排查路径（? 按钮主动展开，不做主动弹出的推断式警告，
            误报会让用户把正确的配置改错）。绝对定位覆盖在轨道上方，不挤压布局。 */}
        {helpOpen && (
          <div id="effort-help-hint" role="tooltip" className={css.helpHint}>
            {helpHintText}
          </div>
        )}

        <div className={css.levelLabels}>
          {efforts.map((entry, labelIndex) => (
            <span
              key={entry.id}
              className={`${css.levelLabel}${labelIndex === displayIndex ? ` ${css.levelLabelActive}` : ''}`}
              style={{ left: levelPos(labelIndex) }}
            >
              {labelIndex === 0 ? 'OFF' : labelIndex === efforts.length - 1 ? 'MAX' : displayName(entry)}
            </span>
          ))}
        </div>
        {/* 轨道无条件渲染：canvas 必须常驻 DOM，WebGL hook 才能在挂载时初始化。 */}
        <div className={css.trackWrapper} style={trackVars}>
          <div className={css.trackBg} />
          <div className={css.dotsLayer}>
            {efforts.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`${css.dot}${dotIndex === displayIndex ? ` ${css.dotActive}` : ''}`}
                style={{ left: levelPos(dotIndex) }}
              />
            ))}
          </div>
          <canvas ref={fireRef} className={css.fire} style={fireStyle} />
          <div className={`${css.pointLight}${dragging ? ` ${css.pointLightOn}` : ''}`} style={pointLightStyle} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={usable ? rawValue : 0}
            disabled={!usable}
            aria-label={t.slider}
            // 读屏播报档位名而非裸数字；displayIndex 只按档位边界变化，
            // 属性值在拖动中不会逐帧刷新（避免读屏刷屏）。
            aria-valuetext={usable && level !== undefined ? displayName(level) : undefined}
            className={`${css.range}${dragging ? ` ${css.rangeGlow}` : ''}`}
            onInput={onInput}
            onPointerDown={() => setDragging(true)}
            onPointerUp={commit}
            onPointerLeave={() => setDragging(false)}
            onBlur={commit}
          />
        </div>
        {!usable && (
          <div className={css.emptyOverlay}>
            {dirErrored ? (
              <>
                <div>{t.loadFailed}</div>
                <button type="button" className={css.retry} onClick={reload}>
                  {t.retry}
                </button>
              </>
            ) : dirLoading ? (
              t.loading
            ) : (
              <>
                <div>{t.unsupported}</div>
                {/* P3-1：方言配错与「不支持」的表现一样，在提示旁给出排查路径，
                    并指出 debugReport 可以看到宿主侧实际写了什么。 */}
                <div className={css.overlayHint}>{t.unsupportedHint}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
