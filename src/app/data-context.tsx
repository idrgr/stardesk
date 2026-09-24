import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getDb, type DataSpace, type StarDeskDB } from '@/data/db/db'

interface DataContextValue {
  space: DataSpace
  db: StarDeskDB
  switchSpace: (space: DataSpace) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [space, setSpace] = useState<DataSpace>('personal')
  const db = useMemo(() => getDb(space), [space])
  const switchSpace = useCallback((next: DataSpace) => {
    setSpace(next)
  }, [])

  const value = useMemo(
    () => ({ space, db, switchSpace }),
    [space, db, switchSpace],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData 必须在 DataProvider 内使用')
  return ctx
}
