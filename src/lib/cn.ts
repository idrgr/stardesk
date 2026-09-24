import { clsx, type ClassValue } from 'clsx'

/** 组合 className，过滤空值。 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
