/**
 * 仿 Claude Code 推理等级 Effort 面板 —— 参考 EffortCard 的 1:1 移植（辉光边框、
 * 渐变卡片、Easy/Intense 刻度标签、WebGL 火焰轨道、发光滑块、拖拽点光源）。
 * 点击官方模型菜单的「推理等级」行时弹出本面板（替代官方档位列表）；
 * 拖动过程连续无级，松手时吸附到最近的档位。
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useWebglFire } from './useWebglFire.ts'
import { snapshotOf, type DirectorySelection, type DirectoryState, type EffortLevel, type ModelDirectoryLike } from './directory.ts'
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

/** Panel width (must match the CSS `.panel` width). */
const PANEL_W = 280

/**
 * 订阅会话共享目录（与 /model 弹层、模型座位同一份状态）。
 * 打开面板时先读一次快照，再订阅后续变化，并触发一次 load()。
 * @param directory - 会话的共享目录。
 * @returns 最新目录快照，首次读取前为 null。
 */
function useDirectory(directory: ModelDirectoryLike): DirectoryState | null {
  const [state, setState] = useState<DirectoryState | null>(() => snapshotOf(directory))

  useEffect(() => {
    let alive = true
    const read = (): void => {
      if (alive) setState(snapshotOf(directory))
    }
    read()
    const stop = directory.store.subscribe(read)
    void directory.load().then(read, (error: unknown) => {
      console.warn('[effort-slider] directory load failed:', error)
    })
    return () => {
      alive = false
      stop()
    }
  }, [directory])

  return state
}

/**
 * The floating effort card.
 * @param props - session + shared directory + close verb.
 */
export function EffortPanel(props: EffortPanelProps): ReactElement {
  const { sessionId, directory, onClose, onEffortChange } = props
  const state = useDirectory(directory)
  const [dragging, setDragging] = useState(false)
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
  const fireRef = useRef<HTMLCanvasElement | null>(null)
  useWebglFire(fireRef, () => slider01, () => true)

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
    // 官方入口自己保留错误提示面，这里只记日志、不打断拖动。
    void directory.select({
      provider: current.provider,
      model: current.model,
      reasoningEffort: effort.id,
    }).catch((error: unknown) => {
      console.warn('[effort-slider] selectModel failed:', error)
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

  return (
    <div className={css.panel} data-effort-panel="true" data-session={sessionId}>
      <div className={css.glow} />
      <div className={css.inner}>
        <div className={css.head}>
          <div className={css.headLeft}>
            <span className={css.labelText}>Effort</span>
            {usable && level !== undefined ? (
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
          <button type="button" className={css.close} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className={css.levelLabels}>
          {efforts.map((entry, labelIndex) => (
            <span
              key={entry.id}
              className={`${css.levelLabel}${labelIndex === displayIndex ? ` ${css.levelLabelActive}` : ''}`}
              style={{ left: `${10 + (labelIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
            >
              {labelIndex === 0 ? 'OFF' : labelIndex === efforts.length - 1 ? 'MAX' : displayName(entry)}
            </span>
          ))}
        </div>
        {/* 轨道无条件渲染：canvas 必须常驻 DOM，WebGL hook 才能在挂载时初始化。 */}
        <div className={css.trackWrapper}>
          <div className={css.trackBg} />
          <div className={css.dotsLayer}>
            {efforts.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`${css.dot}${dotIndex === displayIndex ? ` ${css.dotActive}` : ''}`}
                style={{ left: `${10 + (dotIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
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
            {state === null ? '模型目录加载中…' : '当前模型不支持思考强度调节'}
          </div>
        )}
      </div>
    </div>
  )
}
