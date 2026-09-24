/**
 * 统一日期工具。
 *
 * 约定：
 * - 纯日期使用 YYYY-MM-DD 字符串保存（任务计划日、截止日、打卡日、复盘区间）。
 * - 绝对时间使用 UTC ISO 时间戳保存（createdAt、专注开始时间等）。
 * - 「今天 / 周区间 / 月区间」一律根据设置中的 IANA 时区计算。
 * - 绝不使用 toISOString().slice(0,10) 代替用户当地日期。
 *
 * 日历运算（加减天、求星期、周边界）在纯日历字符串上进行，
 * 通过 `new Date(y, m-1, d)` 构造再读回，不依赖机器时区，保证跨时区正确。
 */

export interface LocalDateParts {
  year: number
  month: number // 1-12
  day: number // 1-31
}

const PAD = (n: number) => String(n).padStart(2, '0')

/** 解析 YYYY-MM-DD；非法输入返回 null。 */
export function parseLocalDate(s: string): LocalDateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export function isValidLocalDate(s: string): boolean {
  const p = parseLocalDate(s)
  if (!p) return false
  const d = new Date(p.year, p.month - 1, p.day)
  return (
    d.getFullYear() === p.year &&
    d.getMonth() === p.month - 1 &&
    d.getDate() === p.day
  )
}

export function formatLocalDate(p: LocalDateParts): string {
  return `${p.year}-${PAD(p.month)}-${PAD(p.day)}`
}

/** 将 YYYY-MM-DD 转为本地日历的 Date（仅用于读取年/月/日/星期，勿转时间戳）。 */
export function toCalendarDate(s: string): Date {
  const p = parseLocalDate(s)
  if (!p) return new Date(NaN)
  return new Date(p.year, p.month - 1, p.day)
}

/** 返回星期几：0=周日 … 6=周六。 */
export function weekdayOf(s: string): number {
  return toCalendarDate(s).getDay()
}

/** 在当前时区的「今天」，返回 YYYY-MM-DD。 */
export function todayInTimeZone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    // 时区无效时回退到设备本地日期。
    return localToday()
  }
}

/** 设备本地「今天」，YYYY-MM-DD（用本地日历，非 toISOString）。 */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`
}

/** 日期加减天数（纯日历）。 */
export function addDaysToDate(s: string, days: number): string {
  const d = toCalendarDate(s)
  if (isNaN(d.getTime())) return s
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`
}

/** 两个日期相差天数（a - b）。 */
export function diffInDays(a: string, b: string): number {
  const da = toCalendarDate(a)
  const db = toCalendarDate(b)
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  const ms = da.getTime() - db.getTime()
  return Math.round(ms / 86400000)
}

export function compareDates(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** 本周起始日（含）。weekStartsOn: 0=周日 … 6=周六。 */
export function startOfWeekDate(s: string, weekStartsOn: number): string {
  const dow = weekdayOf(s)
  const offset = (dow - weekStartsOn + 7) % 7
  return addDaysToDate(s, -offset)
}

export function endOfWeekDate(s: string, weekStartsOn: number): string {
  return addDaysToDate(startOfWeekDate(s, weekStartsOn), 6)
}

export function startOfMonthDate(s: string): string {
  const p = parseLocalDate(s)
  if (!p) return s
  return `${p.year}-${PAD(p.month)}-01`
}

export function endOfMonthDate(s: string): string {
  const p = parseLocalDate(s)
  if (!p) return s
  const last = new Date(p.year, p.month, 0).getDate()
  return `${p.year}-${PAD(p.month)}-${PAD(last)}`
}

export interface DateRange {
  start: string
  end: string
}

/** 以某日期（默认今天）为基准的周区间，按应用时区与周开始日计算。 */
export function weekRange(
  timeZone: string,
  weekStartsOn: number,
  date?: string,
): DateRange {
  const base = date ?? todayInTimeZone(timeZone)
  return {
    start: startOfWeekDate(base, weekStartsOn),
    end: endOfWeekDate(base, weekStartsOn),
  }
}

export function monthRange(timeZone: string, date?: string): DateRange {
  const base = date ?? todayInTimeZone(timeZone)
  return { start: startOfMonthDate(base), end: endOfMonthDate(base) }
}

/** 返回过去 n 天的日期数组（含今天），升序。 */
export function lastNDays(timeZone: string, n: number): string[] {
  const today = todayInTimeZone(timeZone)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addDaysToDate(today, -i))
  return out
}

// ---------------- 展示格式化 ----------------

const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function weekdayLabel(s: string): string {
  return WEEKDAYS_ZH[weekdayOf(s)]
}

/** 显示日期：如「9 月 24 日」。 */
export function formatDateZh(s: string): string {
  const p = parseLocalDate(s)
  if (!p) return s
  return `${p.month} 月 ${p.day} 日`
}

export function formatDateShort(s: string): string {
  const p = parseLocalDate(s)
  if (!p) return s
  return `${p.month}/${p.day}`
}

/** 显示完整日期：如「2026 年 9 月 24 日」。 */
export function formatDateFullZh(s: string): string {
  const p = parseLocalDate(s)
  if (!p) return s
  return `${p.year} 年 ${p.month} 月 ${p.day} 日`
}

/** 将 UTC ISO 时间戳按应用时区格式化为「M 月 d 日 HH:mm」。 */
export function formatDateTimeZh(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('month')} 月 ${get('day')} 日 ${get('hour')}:${get('minute')}`
  } catch {
    return ''
  }
}

/** 相对时间（如「3 分钟前」），用于最近活动。 */
export function relativeTimeZh(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  return formatDateShort(`${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`)
}

/** 将分钟数格式化为「1 小时 25 分 / 45 分钟」。 */
export function formatDuration(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) return '0 分钟'
  const m = Math.round(minutes)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} 小时` : `${h} 小时 ${rest} 分`
}
