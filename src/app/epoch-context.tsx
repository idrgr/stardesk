import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useData } from './data-context'
import { getDataEpoch } from '@/data/db/db'
import { isEpochStale, subscribeEpochChange, attachEpochVisibilityPoll } from '@/data/db/epoch'

interface EpochContextValue {
  /** 数据空间已被其他标签页完整替换，本标签页的写入被拒绝。 */
  isStale: boolean
  /** 最近一次数据替换对应的 epoch（本标签页执行或收到广播时更新）。 */
  epoch: string | null
  /** 数据被替换且尚未重新加载。 */
  replaced: boolean
}

const EpochContext = createContext<EpochContextValue | null>(null)

/**
 * 订阅 dataEpoch 变化。切换数据空间（个人/演示）时重置状态。
 * 该上下文只做「状态广播」；真正的写入拦截在数据层（Dexie 中间件）完成。
 */
export function EpochProvider({ children }: { children: ReactNode }) {
  const { db, space } = useData()
  const [isStale, setIsStale] = useState(() => isEpochStale(db.name))
  const [epoch, setEpoch] = useState<string | null>(null)

  useEffect(() => {
    // 切换数据库时重置为当前数据库的真实状态。
    setIsStale(isEpochStale(db.name))
    let cancelled = false

    void getDataEpoch(db).catch(() => {
      /* 初始化失败时忽略，写入守卫仍会阻止脏写 */
    })

    const stopPoll = attachEpochVisibilityPoll(db.name)

    const off = subscribeEpochChange(db.name, (detail) => {
      if (cancelled) return
      setIsStale(detail.stale)
      if (detail.epoch) setEpoch(detail.epoch)
    })

    return () => {
      cancelled = true
      stopPoll()
      off()
    }
  }, [db, space])

  const value = useMemo(
    () => ({ isStale, epoch, replaced: isStale }),
    [isStale, epoch],
  )

  return <EpochContext.Provider value={value}>{children}</EpochContext.Provider>
}

export function useEpoch(): EpochContextValue {
  const ctx = useContext(EpochContext)
  if (!ctx) throw new Error('useEpoch 必须在 EpochProvider 内使用')
  return ctx
}
