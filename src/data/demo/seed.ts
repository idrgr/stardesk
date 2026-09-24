import type { StarDeskDB } from '@/data/db/db'
import { ensureBuiltinModules } from '@/data/repositories/modules'
import { createGoal } from '@/data/repositories/goals'
import { createProject } from '@/data/repositories/projects'
import { createTask } from '@/data/repositories/tasks'
import { createHabit, checkin } from '@/data/repositories/habits'
import { createActivity } from '@/data/repositories/activities'
import { createNote } from '@/data/repositories/notes'
import { createResource } from '@/data/repositories/resources'
import { createReview, updateReview } from '@/data/repositories/reviews'
import { computeReviewStats } from '@/domain/reviews'
import { addDaysToDate, startOfWeekDate, todayInTimeZone } from '@/lib/date'
import { queryTasks } from '@/data/repositories/tasks'
import { listHabits } from '@/data/repositories/habits'
import { queryActivities } from '@/data/repositories/activities'

const SEED_KEY = 'demoSeeded'

/** 幂等种子演示数据（刷新不重复注入）。日期相对初始化日期生成。 */
export async function seedDemo(db: StarDeskDB, timeZone: string): Promise<void> {
  const existing = await db.meta.get(SEED_KEY)
  if (existing) return

  const today = todayInTimeZone(timeZone)

  const modules = await ensureBuiltinModules(db)
  const byKey = new Map(modules.map((m) => [m.definitionKey, m.id]))
  const growth = byKey.get('growth')!
  const career = byKey.get('career')!
  const hobbies = byKey.get('hobbies')!
  const fitness = byKey.get('fitness')!

  // 目标
  const gGrowth = await createGoal(db, { title: '掌握前端开发', moduleId: growth, status: 'in_progress' })
  const gCareer = await createGoal(db, { title: '提升当前岗位的专业能力', moduleId: career, status: 'in_progress' })
  const gHobby = await createGoal(db, { title: '坚持摄影创作', moduleId: hobbies, status: 'in_progress' })
  const gFitness = await createGoal(db, { title: '保持每周锻炼三次', moduleId: fitness, status: 'in_progress' })

  // 项目
  const pReact = await createProject(db, { title: '学习 React 与 TypeScript', moduleId: growth, goalId: gGrowth.id, projectType: 'skill' })
  const pBook = await createProject(db, { title: '读《刻意练习》', moduleId: growth, goalId: gGrowth.id, projectType: 'book' })
  const pPortfolio = await createProject(db, { title: '整理作品集', moduleId: career, goalId: gCareer.id, projectType: 'other' })
  const pPhoto = await createProject(db, { title: '城市街拍系列', moduleId: hobbies, goalId: gHobby.id, projectType: 'other' })
  const pRun = await createProject(db, { title: '跑步训练周期', moduleId: fitness, goalId: gFitness.id, projectType: 'other' })

  // 任务（待办/进行中/已完成/逾期）
  await createTask(db, { title: '完成 React 官方教程第 3 章', moduleId: growth, projectId: pReact.id, plannedDate: addDaysToDate(startOfWeekDate(today, 1), 0) })
  await createTask(db, { title: '搭建个人作品集页面', moduleId: growth, projectId: pReact.id })
  await createTask(db, { title: '读《刻意练习》第 5 章', moduleId: growth, projectId: pBook.id, plannedDate: addDaysToDate(today, 1), priority: 'high' })
  await createTask(db, { title: '整理面试问题清单', moduleId: career, projectId: pPortfolio.id })
  await createTask(db, { title: '更新简历项目经历', moduleId: career, projectId: pPortfolio.id, plannedDate: addDaysToDate(today, 0), priority: 'high' })
  await createTask(db, { title: '周末街拍练习', moduleId: hobbies, projectId: pPhoto.id, plannedDate: addDaysToDate(today, 5) })
  await createTask(db, { title: '晨跑 5 公里', moduleId: fitness, projectId: pRun.id, plannedDate: addDaysToDate(today, 0), priority: 'high' })
  await createTask(db, { title: '力量训练（下肢）', moduleId: fitness, projectId: pRun.id, plannedDate: addDaysToDate(today, 2) })

  // 习惯
  const hRead = await createHabit(db, { title: '每天阅读 30 分钟', moduleId: growth, startDate: addDaysToDate(today, -14), frequency: { cadence: 'daily', daysOfWeek: [] } })
  const hWater = await createHabit(db, { title: '每天喝水 8 杯', moduleId: fitness, startDate: addDaysToDate(today, -21), frequency: { cadence: 'daily', daysOfWeek: [] } })
  const hRun = await createHabit(db, { title: '每周跑步 3 次', moduleId: fitness, startDate: addDaysToDate(today, -14), frequency: { cadence: 'weekly', daysOfWeek: [1, 3, 5] } })

  for (let i = 7; i >= 1; i--) {
    const d = addDaysToDate(today, -i)
    await checkin(db, hRead.id, d, today)
    if (i % 2 === 0) await checkin(db, hWater.id, d, today)
  }

  // 活动记录
  await createActivity(db, { kind: 'learning', moduleId: growth, projectId: pReact.id, localDate: addDaysToDate(today, -1), title: '学习 React Hooks', durationMinutes: 45, note: '理解了 useEffect 的依赖数组', details: { learning: { topic: 'React Hooks', takeaway: '依赖数组' } } })
  await createActivity(db, { kind: 'learning', moduleId: growth, projectId: pBook.id, localDate: addDaysToDate(today, -3), title: '读《刻意练习》', durationMinutes: 30, note: '刻意练习与舒适区' })
  await createActivity(db, { kind: 'hobby', moduleId: hobbies, projectId: pPhoto.id, localDate: addDaysToDate(today, -2), title: '街拍练习', durationMinutes: 90, note: '拍了 40 张', details: { hobby: { workLink: 'https://example.com/street' } } })
  await createActivity(db, { kind: 'workout', moduleId: fitness, projectId: pRun.id, localDate: addDaysToDate(today, -1), title: '晨跑', durationMinutes: 35, details: { workout: { workoutType: 'running', distanceKm: 5, intensity: 3 } } })
  await createActivity(db, { kind: 'workout', moduleId: fitness, projectId: pRun.id, localDate: addDaysToDate(today, -4), title: '力量训练', durationMinutes: 50, details: { workout: { workoutType: 'strength', intensity: 4 } } })

  // 笔记与资源
  await createNote(db, { title: 'React 学习笔记', bodyMarkdown: '# React\n\n- 组件与状态\n- 副作用与依赖', moduleId: growth, projectId: pReact.id, tags: ['学习'] })
  await createNote(db, { title: '街拍作品集', bodyMarkdown: '城市系列', moduleId: hobbies, noteType: 'work' })
  await createNote(db, { title: '面试复盘', bodyMarkdown: '记录一次面试的经验', moduleId: career, noteType: 'achievement' })
  await createResource(db, { title: 'React 官方文档', url: 'https://react.dev', moduleId: growth, resourceType: 'article' })
  await createResource(db, { title: 'TypeScript 手册', url: 'https://www.typescriptlang.org/docs/', moduleId: growth, resourceType: 'article' })

  // 完成一份周复盘 + 一份草稿
  const weekStart = startOfWeekDate(today, 1)
  const weekEnd = addDaysToDate(weekStart, 6)
  const review = await createReview(db, { periodType: 'week', startDate: weekStart, endDate: weekEnd })
  const tasks = await queryTasks(db, { includeArchived: true })
  const habits = await listHabits(db, { includeArchived: true })
  const checkins = await db.habitCheckins.toArray()
  const activities = await queryActivities(db)
  const stats = computeReviewStats({ tasks, activities, habits, checkins, start: weekStart, end: weekEnd })
  await updateReview(db, review.id, {
    answers: { q1: '完成了 React 教程第三章，理解了 Hooks。', q2: '作品集进度偏慢。', q3: '晨跑让我更有精神。', q4: '完成作品集初稿。' },
    status: 'done',
    statsSnapshot: stats,
    snapshotAt: new Date().toISOString(),
  })

  await db.meta.put({ key: SEED_KEY, value: 'true' })
}
