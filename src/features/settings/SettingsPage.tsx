import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, Moon, Sun, Monitor, Trash2, RotateCcw, Database } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { updateSettings } from '@/data/repositories/settings'
import { exportBackup, validateBackup, importBackup } from '@/data/backup/backup'
import { softDeleteTasks, restoreTasks, queryTasks } from '@/data/repositories/tasks'
import { softDeleteGoals, listGoals } from '@/data/repositories/goals'
import { softDeleteProjects, listProjects } from '@/data/repositories/projects'
import { softDeleteNotes, queryNotes } from '@/data/repositories/notes'
import { formatDateTimeZh } from '@/lib/date'
import { cn } from '@/lib/cn'
import { InstallStarDeskSection } from './InstallStarDeskSection'
import type { BackupEnvelope } from '@/data/backup/backup'

const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Seoul',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles',
  'America/Chicago', 'America/Toronto', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

const DASHBOARD_COMPONENT_LABEL: Record<string, string> = {
  metrics: '今日指标',
  'today-route': '今日航线',
  'today-rhythm': '今日节奏',
  'domain-overview': '领域概览',
  trends: '投入趋势',
  'recent-activity': '最近活动',
}

export function SettingsPage() {
  const { db } = useData()
  const { settings, update } = useSettings()
  const { toast } = useToast()

  const [nickname, setNickname] = useState(settings?.nickname ?? '')
  const [workspaceName, setWorkspaceName] = useState(settings?.workspaceName ?? '')
  const [nicknameDirty, setNicknameDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<BackupEnvelope | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // 回收站数据
  const deletedTasks = useLiveQuery(() => queryTasks(db, { includeDeleted: true }), [db]) ?? []
  const deletedGoals = useLiveQuery(() => listGoals(db, { includeDeleted: true }), [db]) ?? []
  const deletedProjects = useLiveQuery(() => listProjects(db, { includeDeleted: true }), [db]) ?? []
  const deletedNotes = useLiveQuery(() => queryNotes(db, { includeArchived: true }), [db]) ?? []
  const trashTasks = deletedTasks.filter((t) => t.deletedAt)
  const trashGoals = deletedGoals.filter((g) => g.deletedAt)
  const trashProjects = deletedProjects.filter((p) => p.deletedAt)
  const trashNotes = deletedNotes.filter((n) => n.deletedAt)
  const trashCount = trashTasks.length + trashGoals.length + trashProjects.length + trashNotes.length

  const saveProfile = async () => {
    await update({ nickname: nickname.trim(), workspaceName: workspaceName.trim() })
    toast('已保存', 'success')
    setNicknameDirty(false)
  }

  const handleExport = async () => {
    try {
      const envelope = await exportBackup(db, settings?.timeZone ?? 'Asia/Shanghai', 'personal')
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = envelope.exportedAt.slice(0, 10)
      a.href = url
      a.download = `stardesk-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      await updateSettings(db, { lastExportInitiatedAt: new Date().toISOString() })
      toast('已发起下载 · 备份文件已生成', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '导出失败', 'error')
    }
  }

  const handleFile = async (file: File) => {
    setImportError(null)
    setPendingImport(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const envelope = validateBackup(parsed)
      setPendingImport(envelope)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '文件无法解析')
    }
  }

  const handleImport = async () => {
    if (!pendingImport) return
    setImporting(true)
    try {
      await importBackup(db, pendingImport)
      toast('已恢复备份', 'success')
      setPendingImport(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : '恢复失败', 'error')
    } finally {
      setImporting(false)
    }
  }

  const restoreTask = async (id: string) => {
    await restoreTasks(db, [id])
    toast('已恢复', 'success')
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">设置与数据</h1>
        <p className="text-sm text-foreground-muted">个性化工作台，管理你的数据。</p>
      </div>

      {/* 个人与工作台 */}
      <Section title="个人与工作台">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="昵称">
            <Input value={nickname} onChange={(e) => { setNickname(e.target.value); setNicknameDirty(true) }} placeholder="你的昵称" />
          </Field>
          <Field label="工作台名称">
            <Input value={workspaceName} onChange={(e) => { setWorkspaceName(e.target.value); setNicknameDirty(true) }} placeholder="工作台名称" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveProfile} disabled={!nicknameDirty}>保存</Button>
        </div>
      </Section>

      {/* 外观 */}
      <Section title="外观">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="主题">
            <div className="flex gap-1">
              {([['dark', '深色', Moon], ['light', '浅色', Sun], ['system', '跟随系统', Monitor]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ theme: key })}
                  aria-pressed={settings?.theme === key}
                  className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs', settings?.theme === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface')}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="界面密度">
            <div className="flex gap-1">
              {([['comfortable', '舒适'], ['compact', '紧凑']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ density: key })}
                  aria-pressed={settings?.density === key}
                  className={cn('flex-1 rounded-lg border px-2 py-2 text-xs', settings?.density === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground-secondary hover:bg-surface')}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {/* 日期与时区 */}
      <Section title="日期与时区">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="时区">
            <Select value={settings?.timeZone ?? 'Asia/Shanghai'} onChange={(e) => update({ timeZone: e.target.value })}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="每周开始日">
            <Select value={String(settings?.weekStartsOn ?? 1)} onChange={(e) => update({ weekStartsOn: Number(e.target.value) })}>
              <option value="1">周一</option>
              <option value="0">周日</option>
            </Select>
          </Field>
        </div>
      </Section>

      {/* 专注偏好 */}
      <Section title="专注时长偏好">
        <Field label="默认专注时长（分钟）">
          <Input
            type="number"
            min={1}
            value={settings?.focusPreferences.defaultMinutes ?? 25}
            onChange={(e) => update({ focusPreferences: { ...(settings?.focusPreferences ?? { defaultMinutes: 25, presets: [25, 45, 60] }), defaultMinutes: Number(e.target.value) } })}
            className="w-40"
          />
        </Field>
      </Section>

      {/* 首页组件 */}
      <Section title="首页组件">
        <div className="flex flex-col gap-2">
          {(settings?.dashboardLayout ?? []).map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={c.visible}
                onChange={(e) => {
                  const layout = (settings?.dashboardLayout ?? []).map((x) => (x.id === c.id ? { ...x, visible: e.target.checked } : x))
                  update({ dashboardLayout: layout })
                }}
                className="h-4 w-4 accent-[#5DE4F5]"
              />
              {DASHBOARD_COMPONENT_LABEL[c.id] ?? c.id}
            </label>
          ))}
        </div>
      </Section>

      {/* 数据管理 */}
      <Section title="数据管理">
        <p className="text-sm text-foreground-secondary">
          <Database className="mr-1 inline h-4 w-4" />
          数据保存在这个浏览器 / Web App 对应的本地存储中（IndexedDB），不会自动上传云端或备份到 iCloud。更换浏览器、删除 Web App、清除网站数据或访问地址前，请先导出 JSON 备份。
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出备份（JSON）
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            恢复备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="选择备份 JSON 文件"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {settings?.lastExportInitiatedAt && (
          <p className="text-xs text-foreground-muted">
            最近一次发起导出：{formatDateTimeZh(settings.lastExportInitiatedAt, settings.timeZone ?? 'Asia/Shanghai')}
          </p>
        )}

        {importError && <p className="text-sm text-danger">{importError}</p>}

        {pendingImport && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
            <p className="text-sm text-foreground">确认恢复备份？将完整替换当前数据。</p>
            <p className="mt-1 text-xs text-foreground-muted">
              来源：{pendingImport.sourceSpace === 'demo' ? '演示空间（注意）' : '个人空间'} · 导出时间：{formatDateTimeZh(pendingImport.exportedAt, pendingImport.timeZone)}
              · 模块 {pendingImport.recordCounts.modules} · 任务 {pendingImport.recordCounts.tasks} · 笔记 {pendingImport.recordCounts.notes}
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" size="sm" onClick={handleImport} disabled={importing}>
                {importing ? '恢复中…' : '确认替换'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPendingImport(null)}>取消</Button>
            </div>
          </div>
        )}
      </Section>

      <InstallStarDeskSection />

      {/* 回收站 */}
      <Section title={`回收站（${trashCount}）`}>
        {trashCount === 0 ? (
          <p className="text-sm text-foreground-muted">回收站为空。删除的任务、目标、项目和笔记会在这里保留。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {trashTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex-1 truncate text-sm text-foreground">{t.title}</span>
                <span className="text-xs text-foreground-muted">任务</span>
                <Button size="sm" variant="ghost" onClick={() => restoreTask(t.id)}><RotateCcw className="h-3.5 w-3.5" />恢复</Button>
              </div>
            ))}
            {trashGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex-1 truncate text-sm text-foreground">{g.title}</span>
                <span className="text-xs text-foreground-muted">目标</span>
              </div>
            ))}
            {trashProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex-1 truncate text-sm text-foreground">{p.title}</span>
                <span className="text-xs text-foreground-muted">项目</span>
              </div>
            ))}
            {trashNotes.map((n) => (
              <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex-1 truncate text-sm text-foreground">{n.title}</span>
                <span className="text-xs text-foreground-muted">笔记</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
