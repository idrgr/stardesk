import { Clock, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ACTIVITY_KIND_LABEL, WORKOUT_TYPE_LABEL } from '@/domain/enums'
import { formatDateShort, formatDuration } from '@/lib/date'
import type { ActivityLog } from '@/domain/entities'

export function ActivityItem({ activity }: { activity: ActivityLog }) {
  const workout = activity.details.workout
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{activity.title}</p>
          {activity.note && <p className="mt-0.5 line-clamp-2 text-xs text-foreground-secondary">{activity.note}</p>}
        </div>
        <Badge tone="neutral" className="shrink-0">{ACTIVITY_KIND_LABEL[activity.kind]}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {formatDateShort(activity.localDate)}
        </span>
        {activity.durationMinutes != null && activity.durationMinutes > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(activity.durationMinutes)}
          </span>
        )}
        {workout?.workoutType && (
          <span>{WORKOUT_TYPE_LABEL[workout.workoutType]}</span>
        )}
        {workout?.distanceKm != null && <span>{workout.distanceKm} km</span>}
        {workout?.intensity != null && <span>强度 {workout.intensity}/5</span>}
        {activity.details.hobby?.workLink && (
          <a
            href={activity.details.hobby.workLink}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            作品链接 ↗
          </a>
        )}
      </div>
    </div>
  )
}

export function ActivityList({ activities, emptyText }: { activities: ActivityLog[]; emptyText: string }) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-foreground-muted">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {activities.map((a) => (
        <ActivityItem key={a.id} activity={a} />
      ))}
    </div>
  )
}

/** 某组活动记录的时长合计（分钟）。 */
export function totalDuration(activities: ActivityLog[]): number {
  return activities.reduce((sum, a) => sum + (a.durationMinutes ?? 0), 0)
}
