import type { UserSettings } from '@/domain/entities'

export const DEFAULT_DASHBOARD_LAYOUT = [
  { id: 'metrics', visible: true },
  { id: 'today-route', visible: true },
  { id: 'today-rhythm', visible: true },
  { id: 'domain-overview', visible: true },
  { id: 'trends', visible: true },
  { id: 'recent-activity', visible: true },
]

export function deviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || 'Asia/Shanghai'
  } catch {
    return 'Asia/Shanghai'
  }
}

export function defaultSettings(): UserSettings {
  return {
    id: 'settings',
    nickname: '',
    workspaceName: '星枢 StarDesk',
    theme: 'dark',
    density: 'comfortable',
    timeZone: deviceTimeZone(),
    weekStartsOn: 1, // 周一
    focusPreferences: { defaultMinutes: 25, presets: [25, 45, 60] },
    dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
    onboardingCompleted: false,
    lastExportInitiatedAt: null,
  }
}
