import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { createRouteHandlerClient } from "@/lib/supabase/server"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format, parse, isWithinInterval, subDays, subWeeks, getDay } from "date-fns"
import { ko } from "date-fns/locale"

// 응답 스키마 정의
const summarySchema = z.object({
  summary: z.string().describe("전체 요약 (완료율 포함)"),
  urgentTasks: z.array(z.string()).describe("긴급한 할 일 목록"),
  insights: z.array(z.string()).describe("인사이트 목록"),
  recommendations: z.array(z.string()).describe("실행 가능한 추천 사항"),
})

type SummaryPeriod = "today" | "week"

interface TodoAnalysis {
  total: number
  completed: number
  completionRate: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  overdue: number
  todayDue: number
  tomorrowDue: number
  timeDistribution: {
    morning: number // 09:00-12:00
    afternoon: number // 12:00-18:00
    evening: number // 18:00-21:00
    night: number // 21:00-09:00
  }
  urgentTasks: string[]
  // 개선된 분석 데이터
  priorityCompletion: {
    high: { total: number; completed: number; rate: number }
    medium: { total: number; completed: number; rate: number }
    low: { total: number; completed: number; rate: number }
  }
  deadlineCompliance: number // 마감일 준수율
  postponedCount: number // 연기된 할 일 수
  categoryDistribution: Record<string, number>
  dayOfWeekDistribution: Record<number, { total: number; completed: number }>
  completedTasks: any[]
  uncompletedTasks: any[]
  previousPeriodComparison?: {
    completionRate: number
    improvement: number
  }
}

// 할 일 데이터 분석 함수
function analyzeTodos(todos: any[], period: SummaryPeriod, currentDate: Date, allTodos?: any[]): TodoAnalysis {
  const now = currentDate
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfWeek(now, { locale: ko })
  const weekEnd = endOfWeek(now, { locale: ko })

  // 기간 필터링 (더 관대한 필터링)
  let filteredTodos = todos
  if (period === "today") {
    filteredTodos = todos.filter((todo) => {
      // 오늘 마감인 할 일
      if (todo.due_date) {
        const dueDate = new Date(todo.due_date)
        const dueDateOnly = startOfDay(dueDate)
        if (dueDateOnly.getTime() === today.getTime()) {
          return true
        }
      }
      // 오늘 생성된 할 일
      if (todo.created_date) {
        const createdDate = new Date(todo.created_date)
        const createdDateOnly = startOfDay(createdDate)
        if (createdDateOnly.getTime() === today.getTime()) {
          return true
        }
      }
      // 마감일이 지나지 않은 미완료 할 일도 포함 (오늘 처리해야 할 일)
      if (!todo.completed && todo.due_date) {
        const dueDate = new Date(todo.due_date)
        if (dueDate <= todayEnd && dueDate >= today) {
          return true
        }
      }
      return false
    })
  } else if (period === "week") {
    filteredTodos = todos.filter((todo) => {
      // 이번 주 마감인 할 일
      if (todo.due_date) {
        const dueDate = new Date(todo.due_date)
        const dueDateOnly = startOfDay(dueDate)
        if (isWithinInterval(dueDateOnly, { start: weekStart, end: weekEnd })) {
          return true
        }
      }
      // 이번 주 생성된 할 일
      if (todo.created_date) {
        const createdDate = new Date(todo.created_date)
        const createdDateOnly = startOfDay(createdDate)
        if (isWithinInterval(createdDateOnly, { start: weekStart, end: weekEnd })) {
          return true
        }
      }
      // 이번 주에 완료된 할 일 (이번 주에 완료된 것도 포함)
      if (todo.completed && todo.updated_at) {
        const updatedDate = new Date(todo.updated_at)
        const updatedDateOnly = startOfDay(updatedDate)
        if (isWithinInterval(updatedDateOnly, { start: weekStart, end: weekEnd })) {
          return true
        }
      }
      // 마감일이 이번 주 범위 내에 있는 미완료 할 일
      if (!todo.completed && todo.due_date) {
        const dueDate = new Date(todo.due_date)
        const dueDateOnly = startOfDay(dueDate)
        if (dueDateOnly <= weekEnd && dueDateOnly >= weekStart) {
          return true
        }
      }
      return false
    })
  }

  // 이전 기간 데이터 (비교용)
  let previousPeriodTodos: any[] = []
  if (allTodos) {
    if (period === "today") {
      const yesterday = subDays(today, 1)
      previousPeriodTodos = allTodos.filter((todo) => {
        if (!todo.due_date) return false
        const dueDate = new Date(todo.due_date)
        return isWithinInterval(dueDate, { start: startOfDay(yesterday), end: endOfDay(yesterday) })
      })
    } else if (period === "week") {
      const lastWeekStart = subWeeks(weekStart, 1)
      const lastWeekEnd = subWeeks(weekEnd, 1)
      previousPeriodTodos = allTodos.filter((todo) => {
        if (!todo.due_date) return false
        const dueDate = new Date(todo.due_date)
        return isWithinInterval(dueDate, { start: lastWeekStart, end: lastWeekEnd })
      })
    }
  }

  const total = filteredTodos.length
  const completed = filteredTodos.filter((t) => t.completed).length
  const completionRate = total > 0 ? (completed / total) * 100 : 0

  // 완료/미완료 할 일 분리
  const completedTasks = filteredTodos.filter((t) => t.completed)
  const uncompletedTasks = filteredTodos.filter((t) => !t.completed)

  // 우선순위별 완료 패턴 분석
  const priorityCompletion = {
    high: {
      total: filteredTodos.filter((t) => t.priority === "high").length,
      completed: filteredTodos.filter((t) => t.priority === "high" && t.completed).length,
      rate: 0,
    },
    medium: {
      total: filteredTodos.filter((t) => t.priority === "medium").length,
      completed: filteredTodos.filter((t) => t.priority === "medium" && t.completed).length,
      rate: 0,
    },
    low: {
      total: filteredTodos.filter((t) => t.priority === "low").length,
      completed: filteredTodos.filter((t) => t.priority === "low" && t.completed).length,
      rate: 0,
    },
  }

  priorityCompletion.high.rate =
    priorityCompletion.high.total > 0
      ? (priorityCompletion.high.completed / priorityCompletion.high.total) * 100
      : 0
  priorityCompletion.medium.rate =
    priorityCompletion.medium.total > 0
      ? (priorityCompletion.medium.completed / priorityCompletion.medium.total) * 100
      : 0
  priorityCompletion.low.rate =
    priorityCompletion.low.total > 0
      ? (priorityCompletion.low.completed / priorityCompletion.low.total) * 100
      : 0

  // 우선순위 분포 (미완료만)
  const highPriority = filteredTodos.filter((t) => t.priority === "high" && !t.completed).length
  const mediumPriority = filteredTodos.filter((t) => t.priority === "medium" && !t.completed).length
  const lowPriority = filteredTodos.filter((t) => t.priority === "low" && !t.completed).length

  // 마감일 분석
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowEnd = endOfDay(tomorrow)

  const overdue = filteredTodos.filter(
    (t) => !t.completed && t.due_date && new Date(t.due_date) < today
  ).length
  const todayDue = filteredTodos.filter(
    (t) => !t.completed && t.due_date && isWithinInterval(new Date(t.due_date), { start: today, end: todayEnd })
  ).length
  const tomorrowDue = filteredTodos.filter(
    (t) => !t.completed && t.due_date && isWithinInterval(new Date(t.due_date), { start: tomorrow, end: tomorrowEnd })
  ).length

  // 시간대별 분포
  const timeDistribution = {
    morning: 0, // 09:00-12:00
    afternoon: 0, // 12:00-18:00
    evening: 0, // 18:00-21:00
    night: 0, // 21:00-09:00
  }

  filteredTodos.forEach((todo) => {
    if (!todo.due_date) return
    const dueDate = new Date(todo.due_date)
    const hour = dueDate.getHours()

    if (hour >= 9 && hour < 12) {
      timeDistribution.morning++
    } else if (hour >= 12 && hour < 18) {
      timeDistribution.afternoon++
    } else if (hour >= 18 && hour < 21) {
      timeDistribution.evening++
    } else {
      timeDistribution.night++
    }
  })

  // 마감일 준수율 계산 (완료된 할 일 중 마감일 전에 완료한 비율)
  const completedWithDeadline = completedTasks.filter((t) => t.due_date).length
  const onTimeCompleted = completedTasks.filter((t) => {
    if (!t.due_date || !t.updated_at) return false
    const dueDate = new Date(t.due_date)
    const completedDate = new Date(t.updated_at)
    return completedDate <= dueDate
  }).length
  const deadlineCompliance =
    completedWithDeadline > 0 ? (onTimeCompleted / completedWithDeadline) * 100 : 0

  // 연기된 할 일 (마감일이 지났지만 미완료)
  const postponedCount = overdue

  // 카테고리 분포
  const categoryDistribution: Record<string, number> = {}
  filteredTodos.forEach((todo) => {
    const category = todo.category || "기타"
    categoryDistribution[category] = (categoryDistribution[category] || 0) + 1
  })

  // 요일별 분포 (이번주 요약일 때만 의미있음)
  const dayOfWeekDistribution: Record<number, { total: number; completed: number }> = {}
  if (period === "week") {
    for (let i = 0; i < 7; i++) {
      dayOfWeekDistribution[i] = { total: 0, completed: 0 }
    }
    filteredTodos.forEach((todo) => {
      if (todo.due_date) {
        const dueDate = new Date(todo.due_date)
        const dayOfWeek = getDay(dueDate)
        dayOfWeekDistribution[dayOfWeek].total++
        if (todo.completed) {
          dayOfWeekDistribution[dayOfWeek].completed++
        }
      }
    })
  }

  // 이전 기간 대비 개선도
  let previousPeriodComparison:
    | {
        completionRate: number
        improvement: number
      }
    | undefined = undefined

  if (previousPeriodTodos.length > 0) {
    const previousCompleted = previousPeriodTodos.filter((t) => t.completed).length
    const previousRate =
      previousPeriodTodos.length > 0
        ? (previousCompleted / previousPeriodTodos.length) * 100
        : 0
    const improvement = completionRate - previousRate
    previousPeriodComparison = {
      completionRate: previousRate,
      improvement,
    }
  }

  // 긴급한 할 일 (높은 우선순위 + 미완료)
  const urgentTasks = filteredTodos
    .filter((t) => t.priority === "high" && !t.completed)
    .map((t) => t.title)
    .slice(0, 5)

  return {
    total,
    completed,
    completionRate,
    highPriority,
    mediumPriority,
    lowPriority,
    overdue,
    todayDue,
    tomorrowDue,
    timeDistribution,
    urgentTasks,
    priorityCompletion,
    deadlineCompliance,
    postponedCount,
    categoryDistribution,
    dayOfWeekDistribution,
    completedTasks,
    uncompletedTasks,
    previousPeriodComparison,
  }
}

export async function POST(request: Request) {
  try {
    // 인증 확인 (Route Handler에서는 request에서 쿠키를 읽어 클라이언트 생성)
    const supabase = createRouteHandlerClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    // 요청 본문 파싱
    let body
    try {
      body = await request.json()
    } catch (error) {
      return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 })
    }

    const { period } = body as { period: SummaryPeriod }

    if (!period || (period !== "today" && period !== "week")) {
      return Response.json({ error: "기간을 지정해주세요. (today 또는 week)" }, { status: 400 })
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // 현재 날짜 (2025년 12월 23일로 고정)
    const now = new Date(2025, 11, 23)
    const currentDate = format(now, "yyyy-MM-dd")
    const currentDayOfWeek = format(now, "EEEE", { locale: ko })

    // 사용자의 할 일 목록 조회 (모든 할 일 조회)
    const { data: todos, error: todosError } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })

    if (todosError) {
      console.error("할 일 조회 오류:", todosError)
      return Response.json({ error: "할 일 목록을 불러오는데 실패했습니다." }, { status: 500 })
    }

    // 디버깅: 전체 할 일 수 로그
    console.log(`[AI Summary] 전체 할 일 수: ${(todos || []).length}개`)

    // 데이터 분석 (이전 기간 비교를 위해 전체 데이터 전달)
    const analysis = analyzeTodos(todos || [], period, now, todos || [])
    
    // 필터링된 할 일 목록 가져오기 (디버깅용)
    const filteredTodos = period === "today" 
      ? (todos || []).filter((todo) => {
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date)
            const dueDateOnly = startOfDay(dueDate)
            if (dueDateOnly.getTime() === startOfDay(now).getTime()) return true
          }
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date)
            const createdDateOnly = startOfDay(createdDate)
            if (createdDateOnly.getTime() === startOfDay(now).getTime()) return true
          }
          return false
        })
      : (todos || []).filter((todo) => {
          const weekStart = startOfWeek(now, { locale: ko })
          const weekEnd = endOfWeek(now, { locale: ko })
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date)
            const dueDateOnly = startOfDay(dueDate)
            if (isWithinInterval(dueDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date)
            const createdDateOnly = startOfDay(createdDate)
            if (isWithinInterval(createdDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          if (todo.completed && todo.updated_at) {
            const updatedDate = new Date(todo.updated_at)
            const updatedDateOnly = startOfDay(updatedDate)
            if (isWithinInterval(updatedDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          return false
        })
    
    // 필터링된 할 일 목록 가져오기 (디버깅 및 검증용)
    const weekStart = startOfWeek(now, { locale: ko })
    const weekEnd = endOfWeek(now, { locale: ko })
    const today = startOfDay(now)
    const todayEnd = endOfDay(now)
    
    const filteredTodosList = period === "today" 
      ? (todos || []).filter((todo) => {
          // 오늘 마감
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date)
            const dueDateOnly = startOfDay(dueDate)
            if (dueDateOnly.getTime() === today.getTime()) return true
          }
          // 오늘 생성
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date)
            const createdDateOnly = startOfDay(createdDate)
            if (createdDateOnly.getTime() === today.getTime()) return true
          }
          // 오늘 완료
          if (todo.completed && todo.updated_at) {
            const updatedDate = new Date(todo.updated_at)
            const updatedDateOnly = startOfDay(updatedDate)
            if (updatedDateOnly.getTime() === today.getTime()) return true
          }
          return false
        })
      : (todos || []).filter((todo) => {
          // 이번 주 마감
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date)
            const dueDateOnly = startOfDay(dueDate)
            if (isWithinInterval(dueDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          // 이번 주 생성
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date)
            const createdDateOnly = startOfDay(createdDate)
            if (isWithinInterval(createdDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          // 이번 주 완료
          if (todo.completed && todo.updated_at) {
            const updatedDate = new Date(todo.updated_at)
            const updatedDateOnly = startOfDay(updatedDate)
            if (isWithinInterval(updatedDateOnly, { start: weekStart, end: weekEnd })) return true
          }
          return false
        })
    
    // 디버깅: 필터링된 할 일 수 로그
    console.log(`[AI Summary] 전체 할 일: ${(todos || []).length}개`)
    console.log(`[AI Summary] ${period === "today" ? "오늘" : "이번 주"} 필터링된 할 일 수: ${analysis.total}개 (완료: ${analysis.completed}개)`)
    console.log(`[AI Summary] 필터링된 할 일 목록:`, filteredTodosList.map(t => ({
      title: t.title,
      completed: t.completed,
      due_date: t.due_date,
      created_date: t.created_date,
      updated_at: t.updated_at
    })))
    
    // 검증: 분석 결과와 실제 필터링된 목록이 일치하는지 확인
    if (analysis.total !== filteredTodosList.length) {
      console.warn(`[AI Summary] 경고: 분석 결과(${analysis.total}개)와 필터링된 목록(${filteredTodosList.length}개)이 일치하지 않습니다.`)
    }
    console.log(`[AI Summary] 필터링된 할 일 제목:`, filteredTodosList.map(t => `"${t.title}" (완료: ${t.completed})`))

    // 분석 데이터가 없으면 기본 응답
    if (analysis.total === 0) {
      return Response.json({
        summary: period === "today" ? "오늘 예정된 할 일이 없습니다." : "이번 주 예정된 할 일이 없습니다.",
        urgentTasks: [],
        insights: [],
        recommendations: [],
      })
    }

    // AI 요약 생성
    const periodLabel = period === "today" ? "오늘" : "이번 주"
    const periodDescription = period === "today" ? `오늘(${currentDate}, ${currentDayOfWeek})` : `이번 주(${format(startOfWeek(now, { locale: ko }), "yyyy-MM-dd")} ~ ${format(endOfWeek(now, { locale: ko }), "yyyy-MM-dd")})`

    // 완료된 작업의 공통 특징 분석
    const completedCategories = analysis.completedTasks.map((t) => t.category).filter(Boolean)
    const mostCompletedCategory =
      completedCategories.length > 0
        ? Object.entries(
            completedCategories.reduce((acc: Record<string, number>, cat) => {
              acc[cat] = (acc[cat] || 0) + 1
              return acc
            }, {})
          ).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null

    // 미완료 작업의 공통 특징
    const uncompletedCategories = analysis.uncompletedTasks.map((t) => t.category).filter(Boolean)
    const mostPostponedCategory =
      uncompletedCategories.length > 0
        ? Object.entries(
            uncompletedCategories.reduce((acc: Record<string, number>, cat) => {
              acc[cat] = (acc[cat] || 0) + 1
              return acc
            }, {})
          ).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null

    // 문자열 변수로 미리 계산
    const completedCategoryText = mostCompletedCategory ? mostCompletedCategory + " 카테고리" : "없음"
    const postponedCategoryText = mostPostponedCategory ? mostPostponedCategory + " 카테고리" : "없음"

    // 가장 생산적인 시간대
    const mostProductiveTime = Object.entries(analysis.timeDistribution)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "없음"

    const result = await generateObject({
      model: google("gemini-2.0-flash-exp"),
      schema: summarySchema,
      prompt: `다음 할 일 데이터를 심층 분석하여 정교한 요약과 인사이트를 제공해주세요. 한국어로 자연스럽고 친근하며 격려하는 문체로 작성해주세요.

분석 기간: ${periodDescription}
현재 날짜: ${currentDate} (${currentDayOfWeek})

=== 기본 통계 (정확한 숫자) ===
**중요: 아래 숫자를 정확히 사용하세요.**
- 총 할 일: ${analysis.total}개 (정확한 숫자)
- 완료: ${analysis.completed}개 (정확한 숫자)
- 미완료: ${analysis.total - analysis.completed}개 (정확한 숫자)
- 완료율: ${analysis.completionRate.toFixed(1)}% (정확한 퍼센트)
${analysis.previousPeriodComparison ? `- 이전 기간 완료율: ${analysis.previousPeriodComparison.completionRate.toFixed(1)}%` : ""}
${analysis.previousPeriodComparison ? `- 개선도: ${analysis.previousPeriodComparison.improvement > 0 ? "+" : ""}${analysis.previousPeriodComparison.improvement.toFixed(1)}%p` : ""}

**검증: 총 할 일(${analysis.total}개) = 완료(${analysis.completed}개) + 미완료(${analysis.total - analysis.completed}개)**

=== 우선순위별 완료 패턴 ===
- 높음: ${analysis.priorityCompletion.high.completed}/${analysis.priorityCompletion.high.total}개 완료 (${analysis.priorityCompletion.high.rate.toFixed(1)}%)
- 보통: ${analysis.priorityCompletion.medium.completed}/${analysis.priorityCompletion.medium.total}개 완료 (${analysis.priorityCompletion.medium.rate.toFixed(1)}%)
- 낮음: ${analysis.priorityCompletion.low.completed}/${analysis.priorityCompletion.low.total}개 완료 (${analysis.priorityCompletion.low.rate.toFixed(1)}%)

=== 시간 관리 분석 ===
- 마감일 준수율: ${analysis.deadlineCompliance.toFixed(1)}% (마감일 전 완료 비율)
- 연기된 할 일: ${analysis.postponedCount}개
- 오늘 마감: ${analysis.todayDue}개
- 내일 마감: ${analysis.tomorrowDue}개

=== 시간대별 업무 집중도 ===
- 오전 (09:00-12:00): ${analysis.timeDistribution.morning}개
- 오후 (12:00-18:00): ${analysis.timeDistribution.afternoon}개
- 저녁 (18:00-21:00): ${analysis.timeDistribution.evening}개
- 밤 (21:00-09:00): ${analysis.timeDistribution.night}개
- 가장 집중된 시간대: ${mostProductiveTime}

${period === "week" ? `=== 요일별 생산성 패턴 ===
${Object.entries(analysis.dayOfWeekDistribution)
  .map(([day, data]) => {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
    const rate = data.total > 0 ? ((data.completed / data.total) * 100).toFixed(1) : "0.0"
    return `- ${dayNames[parseInt(day)]}요일: ${data.completed}/${data.total}개 완료 (${rate}%)`
  })
  .join("\n")}` : ""}

=== 카테고리 분포 ===
${Object.entries(analysis.categoryDistribution)
  .map(([cat, count]) => `- ${cat}: ${count}개`)
  .join("\n") || "- 카테고리 없음"}

=== 완료된 작업 특징 ===
${mostCompletedCategory ? `- 가장 많이 완료한 카테고리: ${mostCompletedCategory}` : "- 완료된 작업 없음"}

=== 미루는 작업 특징 ===
${mostPostponedCategory ? `- 자주 미루는 카테고리: ${mostPostponedCategory}` : "- 미루는 패턴 없음"}

=== 긴급한 할 일 ===
${analysis.urgentTasks.length > 0 ? analysis.urgentTasks.map((t, i) => `${i + 1}. ${t}`).join("\n") : "없음"}

=== 필수 분석 요구사항 ===

1. **summary (요약)**: 
   ${period === "today" ? "- 오늘의 집중도와 남은 할 일 우선순위를 강조" : "- 주간 패턴 분석과 다음 주 계획 제안 포함"}
   - 완료율과 이전 기간 대비 개선도 포함
   - 긍정적인 톤으로 작성 (예: "총 8개의 할 일 중 5개를 완료하셨어요! 완료율 62.5%로 이전보다 5%p 향상되었습니다.")

2. **urgentTasks (긴급한 할 일)**: 
   - 높은 우선순위 + 미완료 할 일 목록 (최대 5개)

3. **insights (인사이트)**: 3-4개 제공
   **완료율 분석:**
   - 우선순위별 완료 패턴 분석 (어떤 우선순위에서 잘하고 있는지)
   ${analysis.previousPeriodComparison ? `- 이전 기간 대비 개선도 분석 (${analysis.previousPeriodComparison.improvement > 0 ? "개선" : "하락"}된 부분)` : ""}
   
   **시간 관리 분석:**
   - 마감일 준수율 평가 (${analysis.deadlineCompliance.toFixed(1)}%)
   - 연기된 할 일 패턴 파악 (${analysis.postponedCount}개)
   - 시간대별 업무 집중도 분석 (${mostProductiveTime}에 가장 집중)
   
   **생산성 패턴:**
   ${period === "week" ? `- 가장 생산적인 요일 도출\n   - 완료하기 쉬운 작업의 공통 특징 (${completedCategoryText})\n   - 자주 미루는 작업 유형 (${postponedCategoryText})` : "- 당일 집중도 분석"}

4. **recommendations (추천 사항)**: 3-4개 제공, 구체적이고 실행 가능하게
   **시간 관리 팁:**
   - 마감일 준수율 개선 방법
   - 연기 패턴을 줄이는 전략
   - 시간대별 일정 재배치 제안
   
   **우선순위 조정:**
   - 우선순위별 완료 패턴을 고려한 작업 순서 제안
   - 긴급한 할 일 처리 전략
   
   **생산성 향상:**
   ${period === "week" ? "- 생산적인 요일과 시간대를 활용한 계획 수립" : "- 오늘 남은 시간을 효율적으로 활용하는 방법"}
   - 업무 과부하를 줄이는 분산 전략
   - 완료하기 쉬운 작업 유형을 활용한 동기부여 방법

=== 작성 스타일 가이드 ===
- **긍정적인 피드백 우선**: 잘하고 있는 부분을 먼저 강조하고 칭찬
- **격려하는 톤**: 개선점을 지적하기보다는 "더 나아질 수 있는 부분"으로 제시
- **동기부여 메시지**: "잘하고 계세요!", "계속 노력하시면 더 좋아질 거예요" 같은 격려 포함
- **구체적이고 실행 가능**: 추상적인 조언보다는 "오후 2시에 집중력이 높으니 그 시간에 중요한 작업을" 같은 구체적 제안
- **자연스러운 한국어**: 딱딱한 분석 문구보다는 친구가 조언하는 것처럼 자연스럽게
- **기간별 차별화**: 
  ${period === "today" ? "- 오늘의 요약: 당일 집중도와 남은 할 일 우선순위에 집중" : "- 이번주 요약: 주간 패턴 분석과 다음 주 계획 제안 포함"}
- 이모지나 특수 기호는 사용하지 않음

위 데이터를 심층 분석하여 사용자가 이해하기 쉽고, 바로 실천할 수 있는 자연스러운 한국어 문장으로 JSON 형식으로 응답해주세요.`,
    })

    return Response.json(result.object)
  } catch (error: unknown) {
    console.error("AI 요약 오류:", error)

    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."

    // API 호출 한도 초과 체크
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("RESOURCE_EXHAUSTED")
    ) {
      return Response.json(
        { error: "API 호출 한도가 초과되었습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      )
    }

    return Response.json(
      { error: `요약 생성에 실패했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

