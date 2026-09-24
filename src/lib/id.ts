/** 生成稳定的 UUID。浏览器与 Node 均支持 crypto.randomUUID。 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // 兜底（极少环境）：生成 v4 风格 UUID。
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function nowIso(): string {
  return new Date().toISOString()
}
