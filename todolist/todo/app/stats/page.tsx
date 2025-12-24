"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  BarChart3Icon, 
  CheckSquareIcon, 
  ClockIcon, 
  AlertCircleIcon,
  Loader2Icon,
  ArrowLeftIcon,
  TrendingUpIcon,
  PieChartIcon,
  CalendarIcon
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { type Todo, type Priority } from "@/components/todo"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts"

type FilterStatus = "all" | "completed" | "in_progress" | "overdue"

export default function StatsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, supabase } = useAuth()
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [isLoadingTodos, setIsLoadingTodos] = React.useState(false)

  // 할 일 목록 조회
  const fetchTodos = React.useCallback(async () => {
    if (!supabase || !user) {
      return
    }

    setIsLoadingTodos(true)
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_date", { ascending: false })

      if (error) {
        throw error
      }

      setTodos((data as Todo[]) || [])
    } catch (error: unknown) {
      console.error("할 일 목록 조회 실패:", error)
      toast.error("할 일 목록을 불러오는데 실패했습니다.")
      
      const err = error as { code?: string; message?: string }
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
        toast.error("인증이 만료되었습니다. 다시 로그인해주세요.")
      }
    } finally {
      setIsLoadingTodos(false)
    }
  }, [supabase, user])

  // 초기 로드 및 사용자 변경 시 할 일 목록 조회
  React.useEffect(() => {
    if (user && supabase) {
      fetchTodos()
    }
  }, [user, supabase, fetchTodos])

  // 통계 계산
  const stats = React.useMemo(() => {
    const total = todos.length
    const completed = todos.filter(t => t.completed).length
    const now = new Date()
    now.setHours(0, 0, 0, 0) // 시간 부분 제거하여 날짜만 비교
    
    const inProgress = todos.filter(t => {
      if (t.completed) return false
      if (!t.due_date) return true
      const dueDate = new Date(t.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate >= now
    }).length
    
    const overdue = todos.filter(t => {
      if (t.completed) return false
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < now
    }).length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // 카테고리별 통계
    const categoryStats: Record<string, number> = {}
    todos.forEach(todo => {
      const category = todo.category || "미분류"
      categoryStats[category] = (categoryStats[category] || 0) + 1
    })

    // 우선순위별 통계
    const priorityStats: Record<Priority, { total: number; completed: number }> = {
      high: { total: 0, completed: 0 },
      medium: { total: 0, completed: 0 },
      low: { total: 0, completed: 0 },
    }
    todos.forEach(todo => {
      priorityStats[todo.priority].total++
      if (todo.completed) {
        priorityStats[todo.priority].completed++
      }
    })

    // 일별 생성 통계 (최근 7일)
    const dailyStats: Record<string, number> = {}
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dailyStats[dateStr] = 0
    }
    todos.forEach(todo => {
      const dateStr = todo.created_date.split('T')[0]
      if (dailyStats.hasOwnProperty(dateStr)) {
        dailyStats[dateStr]++
      }
    })

    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate,
      categoryStats,
      priorityStats,
      dailyStats,
    }
  }, [todos])

  // 차트 데이터 준비
  const categoryChartData = React.useMemo(() => {
    const colors = [
      "#6366f1", // indigo-500
      "#8b5cf6", // violet-500
      "#ec4899", // pink-500
      "#f59e0b", // amber-500
      "#10b981", // emerald-500
      "#06b6d4", // cyan-500
      "#f97316", // orange-500
      "#84cc16", // lime-500
    ]
    return Object.entries(stats.categoryStats)
      .map(([name, value], index) => ({ 
        name, 
        value,
        color: colors[index % colors.length]

      }))
      .sort((a, b) => b.value - a.value)
  }, [stats.categoryStats])

  const priorityChartData = React.useMemo(() => {
    return Object.entries(stats.priorityStats).map(([priority, data]) => {
      const priorityName = priority === "high" ? "높음" : priority === "medium" ? "보통" : "낮음"
      return {
        priority: priorityName,
        전체: data.total,
        완료: data.completed,
        미완료: data.total - data.completed,
      }
    })
  }, [stats.priorityStats])

  const statusChartData = React.useMemo(() => {
    return [
      { name: "완료", value: stats.completed, color: "#22c55e" }, // green-500
      { name: "진행중", value: stats.inProgress, color: "#3b82f6" }, // blue-500
      { name: "지연", value: stats.overdue, color: "#ef4444" }, // red-500
    ].filter(item => item.value > 0)
  }, [stats.completed, stats.inProgress, stats.overdue])

  const dailyChartData = React.useMemo(() => {
    return Object.entries(stats.dailyStats)
      .map(([date, count]) => {
        const d = new Date(date)
        return {
          date: `${d.getMonth() + 1}/${d.getDate()}`,
          count,
        }
      })
      .sort((a, b) => {
        const dateA = a.date.split('/').map(Number)
        const dateB = b.date.split('/').map(Number)
        if (dateA[0] !== dateB[0]) return dateA[0] - dateB[0]
        return dateA[1] - dateB[1]
      })
  }, [stats.dailyStats])

  const chartConfig = {
    value: {
      label: "개수",
    },
    전체: {
      label: "전체",
      color: "#6366f1", // indigo-500
    },
    완료: {
      label: "완료",
      color: "#22c55e", // green-500
    },
    미완료: {
      label: "미완료",
      color: "#f59e0b", // amber-500
    },
    높음: {
      label: "높음",
      color: "#ef4444", // red-500
    },
    보통: {
      label: "보통",
      color: "#f59e0b", // amber-500
    },
    낮음: {
      label: "낮음",
      color: "#22c55e", // green-500
    },
  }

  // 인증 상태 확인 중이면 로딩 표시
  if (authLoading || isLoadingTodos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 사용자 정보가 없으면 리다이렉트
  if (!user) {
    return null
  }

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="gap-2"
            >
              <ArrowLeftIcon className="size-4" />
              뒤로
            </Button>
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <BarChart3Icon className="size-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">통계</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* 전체 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 할 일</CardTitle>
              <CheckSquareIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">총 할 일 개수</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">완료</CardTitle>
              <CheckSquareIcon className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                완료율: {stats.completionRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">진행중</CardTitle>
              <ClockIcon className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">진행 중인 할 일</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">지연</CardTitle>
              <AlertCircleIcon className="size-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground">마감일 지난 할 일</p>
            </CardContent>
          </Card>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 상태별 파이 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="size-5" />
                상태별 분포
              </CardTitle>
              <CardDescription>완료, 진행중, 지연 상태별 할 일 분포</CardDescription>
            </CardHeader>
            <CardContent>
              {statusChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value, percent }) => `${name}: ${value}개 (${(percent * 100).toFixed(1)}%)`}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 우선순위별 막대 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3Icon className="size-5" />
                우선순위별 통계
              </CardTitle>
              <CardDescription>우선순위별 전체 및 완료 개수</CardDescription>
            </CardHeader>
            <CardContent>
              {priorityChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={priorityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="전체" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="완료" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="미완료" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 카테고리별 막대 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="size-5" />
                카테고리별 통계
              </CardTitle>
              <CardDescription>카테고리별 할 일 개수</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={categoryChartData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value">
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 일별 생성 추이 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="size-5" />
                최근 7일 생성 추이
              </CardTitle>
              <CardDescription>일별로 생성된 할 일 개수</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={{ fill: "#6366f1", r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 상세 통계 테이블 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 카테고리별 상세 */}
          <Card>
            <CardHeader>
              <CardTitle>카테고리별 상세</CardTitle>
              <CardDescription>각 카테고리별 할 일 개수</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.categoryStats).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.categoryStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="font-medium">{category}</span>
                        <span className="text-sm text-muted-foreground">{count}개</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  카테고리 데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 우선순위별 상세 */}
          <Card>
            <CardHeader>
              <CardTitle>우선순위별 상세</CardTitle>
              <CardDescription>우선순위별 전체 및 완료 개수</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.priorityStats).map(([priority, data]) => {
                  const priorityName = priority === "high" ? "높음" : priority === "medium" ? "보통" : "낮음"
                  const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
                  
                  return (
                    <div key={priority} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{priorityName}</span>
                        <span className="text-sm text-muted-foreground">
                          완료율: {completionRate}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">전체</span>
                          <span className="font-medium">{data.total}개</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">완료</span>
                          <span className="font-medium text-green-600">{data.completed}개</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">미완료</span>
                          <span className="font-medium text-orange-600">{data.total - data.completed}개</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

