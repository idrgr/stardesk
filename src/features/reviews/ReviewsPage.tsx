import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, ArrowRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Field } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useData } from '@/app/data-context'
import { useSettings } from '@/app/settings-context'
import { useToast } from '@/components/ui/Toast'
import { getReviewForPeriod, createReview, updateReview, convertNextActions } from '@/data/repositories/reviews'
import { queryTasks } from '@/data/repositories/tasks'
import { queryActivities } from '@/data/repositories/activities'
import { listHabits } from '@/data/repositories/habits'
import { listEnabledModules } from '@/data/repositories/modules'
import { computeReviewStats, DEFAULT_REVIEW_QUESTIONS, type ReviewStats } from '@/domain/reviews'
import { weekRange, monthRange, formatDateShort, formatDuration } from '@/lib/date'
import type { Review, ReviewNextAction } from '@/domain/entities'
import type { ReviewPeriod } from '@/domain/enums'
import { cn } from '@/lib/cn'

export function ReviewsPage() {
  const { db } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const timeZone = settings?.timeZone ?? 'Asia/Shanghai'
  const weekStartsOn = settings?.weekStartsOn ?? 1

  const [periodType, setPeriodType] = useState<ReviewPeriod>('week')
  const range = periodType === 'week' ? weekRange(timeZone, weekStartsOn) : monthRange(timeZone)

  const tasks = useLiveQuery(() => queryTasks(db, { includeArchived: true, includeCancelled: true }), [db]) ?? []
  const activities = useLiveQuery(() => queryActivities(db), [db]) ?? []
  const habits = useLiveQuery(() => listHabits(db, { includeArchived: true }), [db]) ?? []
  const checkins = useLiveQuery(() => db.habitCheckins.toArray(), [db]) ?? []
  const modules = useLiveQuery(() => listEnabledModules(db), [db]) ?? []

  const review = useLiveQuery(() => getReviewForPeriod(db, periodType, range.start, range.end), [db, periodType, range.start, range.end])

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [actions, setActions] = useState<ReviewNextAction[]>([])
  const [saving, setSaving] = useState(false)

  // 加载复盘后同步本地编辑状态。
  useEffect(() => {
    if (review) {
      setAnswers(review.answers ?? {})
      setActions(review.nextActions ?? [])
    } else {
      setAnswers({})
      setActions([])
    }
  }, [review?.id])

  const liveStats = useMemo<ReviewStats>(
    () => computeReviewStats({ tasks, activities, habits, checkins, start: range.start, end: range.end }),
    [tasks, activities, habits, checkins, range.start, range.end],
  )

  const stats = review?.status === 'done' && review.statsSnapshot ? review.statsSnapshot : liveStats
  const isDone = review?.status === 'done'

  /**
   * 取得（必要时创建）本期复盘，并把当前编辑内容一并落库。
   *
   * 必须同时写入 answers / nextActions：复盘行一旦被创建，下方的同步 effect 会以
   * 数据库中的内容覆盖本地状态。若这里只创建空复盘，用户刚输入、尚未保存的
   * 「下一周期行动」会被立刻清空（输入丢失，且转换入口随之失效）。
   */
  const ensureReview = async (): Promise<Review> => {
    if (review) {
      // 已存在：把当前编辑内容写回，避免同步 effect 以库中旧内容覆盖。
      return updateReview(db, review.id, { answers, nextActions: actions })
    }
    // 首次创建时直接带上当前编辑内容，不要先落一个空复盘再补写：
    // 中间态会让同步 effect 把用户刚输入的行动清空。
    return createReview(db, {
      periodType,
      startDate: range.start,
      endDate: range.end,
      answers,
      nextActions: actions,
    })
  }

  const save = async (status: Review['status']) => {
    setSaving(true)
    try {
      const r = await ensureReview()
      const snapshot = status === 'done' ? liveStats : r.statsSnapshot
      await updateReview(db, r.id, {
        answers,
        nextActions: actions,
        status,
        statsSnapshot: snapshot,
        snapshotAt: status === 'done' ? new Date().toISOString() : r.snapshotAt,
      })
      toast(status === 'done' ? '复盘已完成' : '草稿已保存', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const refreshSnapshot = async () => {
    if (!review) return
    await updateReview(db, review.id, { statsSnapshot: liveStats, snapshotAt: new Date().toISOString() })
    toast('统计快照已更新', 'success')
  }

  const handleConvert = async () => {
    const pending = actions.filter((a) => a.title.trim())
    if (pending.length === 0) return
    try {
      // 尚未保存过草稿时先创建本期复盘，避免首次使用者无法转换。
      const target = await ensureReview()
      const created = await convertNextActions(db, target.id, pending)
      toast(
        created.length > 0
          ? `已创建 ${created.length} 项任务`
          : '这些行动已转换过，未重复创建',
        created.length > 0 ? 'success' : 'info',
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : '转换失败', 'error')
    }
  }

  const addAction = () => {
    setActions((a) => [...a, { title: '', plannedDate: range.end, moduleId: null }])
  }
  const updateAction = (i: number, patch: Partial<ReviewNextAction>) => {
    setActions((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">周期复盘</h1>
          <p className="text-sm text-foreground-muted">
            {periodType === 'week' ? '周复盘' : '月复盘'} · {formatDateShort(range.start)} – {formatDateShort(range.end)}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(['week', 'month'] as ReviewPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodType(p)}
              className={cn('rounded-md px-3 py-1 text-sm', periodType === p ? 'bg-accent/10 text-accent' : 'text-foreground-secondary hover:text-foreground')}
            >
              {p === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>

      {isDone && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          <Check className="h-4 w-4" />
          已完成复盘，显示完成时的统计快照
          <Button variant="ghost" size="sm" onClick={refreshSnapshot} className="ml-auto">更新快照</Button>
        </div>
      )}

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="完成任务" value={String(stats.tasksCompleted)} />
        <StatCard label="学习投入" value={formatDuration(stats.learningMinutes)} />
        <StatCard label="兴趣投入" value={formatDuration(stats.hobbyMinutes)} />
        <StatCard label="运动投入" value={formatDuration(stats.workoutMinutes)} />
        <StatCard label="习惯达成" value={stats.habitOpportunities === 0 ? '暂无安排' : `${stats.habitCompleted}/${stats.habitOpportunities}`} />
      </div>

      {/* 问题 */}
      <section className="flex flex-col gap-4">
        {DEFAULT_REVIEW_QUESTIONS.map((q, i) => (
          <Field key={i} label={q}>
            <Textarea
              value={answers[`q${i + 1}`] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [`q${i + 1}`]: e.target.value }))}
              placeholder="写下你的回答…"
            />
          </Field>
        ))}
      </section>

      {/* 下一周期行动 */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-secondary">下一周期行动</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={addAction}>
              <Plus className="h-4 w-4" />
              添加
            </Button>
            <Button variant="primary" size="sm" onClick={handleConvert} disabled={actions.filter((a) => a.title.trim()).length === 0}>
              <ArrowRight className="h-4 w-4" />
              转换为任务
            </Button>
          </div>
        </div>
        {actions.length === 0 ? (
          <p className="text-sm text-foreground-muted">下一周期最重要的一到三件事，可以显式转成任务。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <Input
                  value={a.title}
                  onChange={(e) => updateAction(i, { title: e.target.value })}
                  placeholder="行动标题"
                  aria-label="行动标题"
                  className="min-w-0 flex-1"
                />
                <Input type="date" value={a.plannedDate} onChange={(e) => updateAction(i, { plannedDate: e.target.value })} className="w-40" aria-label="计划日期" />
                <Select value={a.moduleId ?? ''} onChange={(e) => updateAction(i, { moduleId: e.target.value || null })} className="w-32" aria-label="领域">
                  <option value="">无领域</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActions((arr) => arr.filter((_, idx) => idx !== i))} aria-label="删除行动">
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 保存 */}
      <div className="flex justify-end gap-2 border-t border-divider pt-4">
        <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
          <Save className="h-4 w-4" />
          保存草稿
        </Button>
        <Button variant="primary" onClick={() => save('done')} disabled={saving}>
          <Check className="h-4 w-4" />
          标记完成
        </Button>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tnum text-foreground">{value}</p>
    </div>
  )
}
