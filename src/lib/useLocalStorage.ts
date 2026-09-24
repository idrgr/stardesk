import { useEffect, useState } from 'react'

/** 轻量 UI 偏好（仅用于 localStorage，不作为业务数据来源）。 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 忽略 */
    }
  }, [key, value])

  return [value, setValue] as const
}
