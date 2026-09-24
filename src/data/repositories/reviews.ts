import type { StarDeskDB } from '@/data/db/db'
import type { Review, ReviewNextAction } from '@/domain/entities'
import type { ReviewPeriod, ReviewStatus } from '@/domain/enums'
import { newBase, bump } from './base'
import { createTask } from './tasks'

export async function getReviewForPeriod(
  db: StarDeskDB,
  periodType: ReviewPeriod,
  startDate: string,
  endDate: string,
): Promise<Review | undefined> {
  const reviews = await db.reviews.toArray()
  return reviews.find(
    (r) => !r.deletedAt && r.periodType === periodType && r.startDate === startDate && r.endDate === endDate,
  )
}

export async function getReview(db: StarDeskDB, id: string): Promise<Review | undefined> {
  return db.reviews.get(id)
}

export async function createReview(
  db: StarDeskDB,
  input: {
    periodType: ReviewPeriod
    startDate: string
    endDate: string
    /** 创建时一并写入的编辑内容：避免先落一个空复盘、再补写造成中间态。 */
    answers?: Record<string, string>
    nextActions?: ReviewNextAction[]
  },
): Promise<Review> {
  const existing = await getReviewForPeriod(db, input.periodType, input.startDate, input.endDate)
  if (existing) return existing
  const review: Review = {
    ...newBase(),
    periodType: input.periodType,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'draft',
    answers: input.answers ?? {},
    statsSnapshot: null,
    snapshotAt: null,
    nextActions: input.nextActions ?? [],
    convertedTaskIds: [],
  }
  await db.reviews.add(review)
  return review
}

export type ReviewPatch = Partial<
  Pick<Review, 'answers' | 'status' | 'statsSnapshot' | 'snapshotAt' | 'nextActions'>
>

export async function updateReview(db: StarDeskDB, id: string, patch: ReviewPatch): Promise<Review> {
  return db.transaction('rw', db.reviews, async () => {
    const existing = await db.reviews.get(id)
    if (!existing) throw new Error('复盘不存在')
    const merged = bump({ ...existing, ...patch })
    await db.reviews.put(merged)
    return merged
  })
}

/** 将下一周期行动显式转为真实任务（幂等，防止重复点击产生重复任务）。 */
export async function convertNextActions(
  db: StarDeskDB,
  reviewId: string,
  actions: ReviewNextAction[],
): Promise<string[]> {
  return db.transaction('rw', db.reviews, db.tasks, db.projects, async () => {
    const review = await db.reviews.get(reviewId)
    if (!review) throw new Error('复盘不存在')
    const created: string[] = []
    for (const a of actions) {
      if (!a.title.trim()) continue
      const already = review.convertedTaskIds.includes(a.title)
      if (already) continue
      const task = await createTask(db, {
        title: a.title,
        moduleId: a.moduleId,
        plannedDate: a.plannedDate || null,
      })
      created.push(task.id)
    }
    if (created.length > 0) {
      await db.reviews.put(
        bump({
          ...review,
          convertedTaskIds: [...review.convertedTaskIds, ...actions.filter((a) => a.title.trim()).map((a) => a.title)],
        }),
      )
    }
    return created
  })
}
