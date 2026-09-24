import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { UserSettings } from '@/domain/entities'
import { getSettings, updateSettings } from '@/data/repositories/settings'
import { useData } from './data-context'

const THEME_STORAGE_KEY = 'stardesk.theme'

function resolveTheme(pref: UserSettings['theme']): 'dark' | 'light' {
  if (pref === 'dark' || pref === 'light') return pref
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'light'
  }
  return 'dark'
}

function applyTheme(pref: UserSettings['theme']) {
  const resolved = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* 忽略存储失败（仅用于预加载） */
  }
}

interface SettingsContextValue {
  settings: UserSettings | undefined
  loading: boolean
  update: (patch: Partial<Omit<UserSettings, 'id'>>) => Promise<UserSettings>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { db } = useData()
  const settings = useLiveQuery(() => getSettings(db), [db])

  useEffect(() => {
    if (settings) applyTheme(settings.theme)
  }, [settings?.theme])

  // 跟随系统时，监听系统主题变化。
  useEffect(() => {
    if (!settings || settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings?.theme])

  const update = useCallback(
    (patch: Partial<Omit<UserSettings, 'id'>>) => updateSettings(db, patch),
    [db],
  )

  const value = useMemo(
    () => ({ settings, loading: settings === undefined, update }),
    [settings, update],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings 必须在 SettingsProvider 内使用')
  return ctx
}

export { THEME_STORAGE_KEY }
