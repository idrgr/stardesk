/**
 * dataEpoch 级跨标签页失效控制。
 *
 * 场景：某个标签页执行「完整替换恢复」后，数据库内容被整体替换并生成新的 dataEpoch。
 * 其他已打开的标签页持有的是旧数据的缓存、旧表单草稿和旧计时会话，必须：
 *   1. 发现数据空间已被替换（缓存失效）；
 *   2. 阻止旧表单继续直接写入（写入被拒绝，而不是静默覆盖新数据）；
 *   3. 停止旧的运行中/暂停专注会话计时；
 *   4. 保留用户尚未提交的输入，并提示重新读取数据。
 *
 * 实现要点：
 * - 写入拦截使用 Dexie 的 dbcore 中间件在 `mutate` 这一层统一收口，
 *   覆盖所有表与所有调用路径，无需在每个仓储函数里手写检查。
 * - 跨标签页通知优先用 BroadcastChannel；不可用时回退到 localStorage 的 storage 事件。
 * - 本模块不依赖 React；UI 通过 subscribeEpochChange 订阅。
 */

import Dexie from 'dexie'

/** 数据空间已被完整替换，当前标签页的写入必须被拒绝。 */
export class StaleDataError extends Error {
  constructor() {
    super('数据已在其他标签页被完整恢复替换，请重新加载页面后再编辑。')
    this.name = 'StaleDataError'
  }
}

interface EpochState {
  /** 当前标签页已知的 epoch。 */
  knownEpoch: string | null
  /** 是否已被远程恢复置为失效。 */
  stale: boolean
  /** 远程恢复后的新 epoch。 */
  incomingEpoch: string | null
  channel: BroadcastChannel | null
  listeners: Set<(detail: { stale: boolean; epoch: string | null }) => void>
  /** storage 回退用的键名。 */
  storageKey: string
  storageHandler: ((e: StorageEvent) => void) | null
}

const states = new Map<string, EpochState>()

function stateFor(dbName: string): EpochState {
  let s = states.get(dbName)
  if (!s) {
    s = {
      knownEpoch: null,
      stale: false,
      incomingEpoch: null,
      channel: null,
      listeners: new Set(),
      storageKey: `stardesk.epoch.${dbName}`,
      storageHandler: null,
    }
    states.set(dbName, s)
  }
  return s
}

function emit(s: EpochState): void {
  const detail = { stale: s.stale, epoch: s.incomingEpoch }
  for (const fn of s.listeners) fn(detail)
}

/** 标记本标签页数据已陈旧。幂等。 */
export function markEpochStale(dbName: string, incomingEpoch: string | null): void {
  const s = stateFor(dbName)
  if (s.stale && s.incomingEpoch === incomingEpoch) return
  s.stale = true
  s.incomingEpoch = incomingEpoch
  emit(s)
}

export function isEpochStale(dbName: string): boolean {
  return stateFor(dbName).stale
}

export function getKnownEpoch(dbName: string): string | null {
  return stateFor(dbName).knownEpoch
}

export function getIncomingEpoch(dbName: string): string | null {
  return stateFor(dbName).incomingEpoch
}

/** 订阅失效状态变化。返回取消订阅函数。 */
export function subscribeEpochChange(
  dbName: string,
  fn: (detail: { stale: boolean; epoch: string | null }) => void,
): () => void {
  const s = stateFor(dbName)
  s.listeners.add(fn)
  return () => s.listeners.delete(fn)
}

/** 记录本标签页当前认可的 epoch（启动时与本地恢复成功后调用）。 */
export function setKnownEpoch(dbName: string, epoch: string): void {
  const s = stateFor(dbName)
  s.knownEpoch = epoch
}

/**
 * 广播「数据空间已被替换」。
 * 本标签页自身不进入失效状态（它持有的是新数据）。
 */
export function publishEpochChange(dbName: string, epoch: string): void {
  const s = stateFor(dbName)
  s.knownEpoch = epoch
  s.stale = false
  s.incomingEpoch = null
  // 本标签页自己执行了恢复：通知本地订阅者（数据已整体替换，可清理本地草稿），
  // 但不进入失效状态——它持有的正是新数据。
  emit(s)

  if (s.channel) {
    try {
      s.channel.postMessage({ type: 'epoch', epoch })
    } catch {
      /* 忽略：下面的 storage 回退仍会生效 */
    }
  }
  // 同时写 storage 作为回退（BroadcastChannel 不可用或被策略阻止时生效）。
  try {
    localStorage.setItem(s.storageKey, JSON.stringify({ epoch, at: new Date().toISOString() }))
  } catch {
    /* 忽略存储失败 */
  }
}

/** 从 storage 回退键与可见性变化中补检 epoch（Safari / 多标签页 BC 异常时）。 */
export function refreshEpochStaleFromHints(dbName: string): void {
  const s = stateFor(dbName)
  if (s.stale) return
  try {
    const raw = localStorage.getItem(s.storageKey)
    if (!raw) return
    const parsed = JSON.parse(raw) as { epoch?: string }
    if (
      typeof parsed.epoch === 'string' &&
      s.knownEpoch !== null &&
      parsed.epoch !== s.knownEpoch
    ) {
      markEpochStale(dbName, parsed.epoch)
    }
  } catch {
    /* 忽略 */
  }
}

/** 页面可见时与定时轮询，避免 BroadcastChannel 偶发未送达。 */
export function attachEpochVisibilityPoll(dbName: string): () => void {
  if (typeof document === 'undefined') return () => undefined
  const tick = () => refreshEpochStaleFromHints(dbName)
  const onVis = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVis)
  const id = window.setInterval(tick, 20_000)
  return () => {
    document.removeEventListener('visibilitychange', onVis)
    window.clearInterval(id)
  }
}

/** 安装跨标签页监听（BroadcastChannel 优先，storage 事件回退）。幂等。 */
export function attachEpochChannel(dbName: string): void {
  const s = stateFor(dbName)
  if (s.channel || s.storageHandler) return

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(`stardesk-epoch-${dbName}`)
      ch.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; epoch?: string } | null
        if (data && data.type === 'epoch' && typeof data.epoch === 'string') {
          if (s.knownEpoch !== null && data.epoch === s.knownEpoch) return
          markEpochStale(dbName, data.epoch)
        }
      }
      s.channel = ch
    } catch {
      s.channel = null
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const handler = (e: StorageEvent) => {
      if (e.key !== s.storageKey || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as { epoch?: string }
        if (typeof parsed.epoch === 'string') {
          if (s.knownEpoch !== null && parsed.epoch === s.knownEpoch) return
          markEpochStale(dbName, parsed.epoch)
        }
      } catch {
        /* 忽略无法解析的值 */
      }
    }
    window.addEventListener('storage', handler)
    s.storageHandler = handler
  }
}

/**
 * 为数据库安装写入守卫：一旦本标签页被判定为陈旧，
 * 除 meta 表（epoch 自身）以外的所有写入都会被拒绝。
 */
export function installEpochWriteGuard(db: Dexie): void {
  attachEpochChannel(db.name)
  db.use({
    stack: 'dbcore',
    name: 'stardesk-epoch-guard',
    create(downlevelDatabase) {
      return {
        ...downlevelDatabase,
        table(name: string) {
          const downlevelTable = downlevelDatabase.table(name)
          if (name === 'meta') return downlevelTable
          return {
            ...downlevelTable,
            mutate(req: unknown) {
              if (isEpochStale(db.name)) {
                return Dexie.Promise.reject(new StaleDataError()) as never
              }
              return downlevelTable.mutate(req as never)
            },
          }
        },
      }
    },
  })
}
