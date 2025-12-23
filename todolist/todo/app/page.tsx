"use client"

import * as React from "react"
import { CheckSquareIcon, LogOutIcon, SearchIcon, FilterIcon, ArrowUpDownIcon, PlusIcon, Loader2Icon, SparklesIcon, LightbulbIcon, TrendingUpIcon, UserIcon, TrashIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { TodoForm, TodoList, type Todo, type TodoFormData, type Priority } from "@/components/todo"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type SortOption = "created_date" | "due_date" | "priority" | "title"
type FilterStatus = "all" | "completed" | "in_progress" | "overdue"

export default function HomePage() {
  const { user, isLoading: authLoading, signOut, supabase } = useAuth()

  const [todos, setTodos] = React.useState<Todo[]>([])
  const [isLoadingTodos, setIsLoadingTodos] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [priorityFilter, setPriorityFilter] = React.useState<Priority | "all">("all")
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>("all")
  const [sortBy, setSortBy] = React.useState<SortOption>("created_date")
  const [editingTodo, setEditingTodo] = React.useState<Todo | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [summaryPeriod, setSummaryPeriod] = React.useState<"today" | "week">("today")
  const [summaryData, setSummaryData] = React.useState<{
    summary: string
    urgentTasks: string[]
    insights: string[]
    recommendations: string[]
  } | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(false)
  const [showProfileDialog, setShowProfileDialog] = React.useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = React.useState(false)
  const [deleteEmail, setDeleteEmail] = React.useState("")
  const [deletePassword, setDeletePassword] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false)

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
      
      // 인증 오류인 경우
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

  // 필터링 및 정렬된 할 일 목록
  const filteredAndSortedTodos = React.useMemo(() => {
    let filtered = [...todos]

    // 검색 필터 (제목만 검색)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((todo) => todo.title.toLowerCase().includes(query))
    }

    // 우선순위 필터
    if (priorityFilter !== "all") {
      filtered = filtered.filter((todo) => todo.priority === priorityFilter)
    }

    // 상태 필터
    if (statusFilter !== "all") {
      filtered = filtered.filter((todo) => {
        if (statusFilter === "completed") return todo.completed
        if (statusFilter === "in_progress") {
          return !todo.completed && (!todo.due_date || new Date(todo.due_date) >= new Date())
        }
        if (statusFilter === "overdue") {
          return !todo.completed && todo.due_date && new Date(todo.due_date) < new Date()
        }
        return true
      })
    }

    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === "created_date") {
        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
      }
      if (sortBy === "due_date") {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      if (sortBy === "priority") {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "ko")
      }
      return 0
    })

    return filtered
  }, [todos, searchQuery, priorityFilter, statusFilter, sortBy])

  const handleCreateTodo = async (data: TodoFormData) => {
    if (!supabase || !user) {
      toast.error("인증이 필요합니다.")
      return
    }

    try {
      const { error } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          priority: data.priority,
          category: data.category || null,
          completed: false,
        })

      if (error) {
        throw error
      }

      // 목록 새로고침
      await fetchTodos()
      setShowForm(false)
      toast.success("할 일이 추가되었습니다.")
    } catch (error: unknown) {
      console.error("할 일 생성 실패:", error)
      const err = error as { message?: string; code?: string }
      toast.error(err?.message || "할 일 추가에 실패했습니다.")
      
      // 인증 오류인 경우
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
        toast.error("인증이 만료되었습니다. 다시 로그인해주세요.")
      }
    }
  }

  const handleUpdateTodo = async (data: TodoFormData) => {
    if (!editingTodo || !supabase || !user) {
      toast.error("수정할 할 일이 없습니다.")
      return
    }

    // 본인 소유 확인
    if (editingTodo.user_id !== user.id) {
      toast.error("본인의 할 일만 수정할 수 있습니다.")
      return
    }

    try {
      const { error } = await supabase
        .from("todos")
        .update({
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          priority: data.priority,
          category: data.category || null,
        })
        .eq("id", editingTodo.id)
        .eq("user_id", user.id) // 추가 보안: user_id도 확인

      if (error) {
        throw error
      }

      // 목록 새로고침
      await fetchTodos()
      setEditingTodo(null)
      setShowForm(false)
      toast.success("할 일이 수정되었습니다.")
    } catch (error: unknown) {
      console.error("할 일 수정 실패:", error)
      const err = error as { message?: string; code?: string }
      toast.error(err?.message || "할 일 수정에 실패했습니다.")
      
      // 인증 오류인 경우
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
        toast.error("인증이 만료되었습니다. 다시 로그인해주세요.")
      }
    }
  }

  const handleDeleteTodo = async (id: string) => {
    if (!supabase || !user) {
      toast.error("인증이 필요합니다.")
      return
    }

    // 삭제할 할 일 찾기
    const todoToDelete = todos.find((todo) => todo.id === id)
    if (!todoToDelete) {
      toast.error("삭제할 할 일을 찾을 수 없습니다.")
      return
    }

    // 본인 소유 확인
    if (todoToDelete.user_id !== user.id) {
      toast.error("본인의 할 일만 삭제할 수 있습니다.")
      return
    }

    // 확인창 표시
    if (!confirm(`"${todoToDelete.title}" 할 일을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id) // 추가 보안: user_id도 확인

      if (error) {
        throw error
      }

      // 목록 새로고침
      await fetchTodos()
      toast.success("할 일이 삭제되었습니다.")
    } catch (error: unknown) {
      console.error("할 일 삭제 실패:", error)
      const err = error as { message?: string; code?: string }
      toast.error(err?.message || "할 일 삭제에 실패했습니다.")
      
      // 인증 오류인 경우
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
        toast.error("인증이 만료되었습니다. 다시 로그인해주세요.")
      }
    }
  }

  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (!supabase || !user) {
      toast.error("인증이 필요합니다.")
      return
    }

    // 수정할 할 일 찾기
    const todoToUpdate = todos.find((todo) => todo.id === id)
    if (!todoToUpdate) {
      toast.error("할 일을 찾을 수 없습니다.")
      return
    }

    // 본인 소유 확인
    if (todoToUpdate.user_id !== user.id) {
      toast.error("본인의 할 일만 수정할 수 있습니다.")
      return
    }

    try {
      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id)
        .eq("user_id", user.id) // 추가 보안: user_id도 확인

      if (error) {
        throw error
      }

      // 목록 새로고침
      await fetchTodos()
      toast.success(completed ? "할 일을 완료했습니다." : "할 일을 다시 시작합니다.")
    } catch (error: unknown) {
      console.error("할 일 상태 변경 실패:", error)
      const err = error as { message?: string; code?: string }
      toast.error(err?.message || "할 일 상태 변경에 실패했습니다.")
      
      // 인증 오류인 경우
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
        toast.error("인증이 만료되었습니다. 다시 로그인해주세요.")
      }
    }
  }

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo)
    setShowForm(true)
  }

  const handleLogout = async () => {
    try {
      const { error } = await signOut()

      if (error) {
        toast.error("로그아웃 중 오류가 발생했습니다.")
        console.error("Logout error:", error)
        return
      }

      // 로그아웃 성공 (useAuth에서 리다이렉트 처리)
      toast.success("로그아웃되었습니다.")
    } catch (error) {
      toast.error("로그아웃 중 오류가 발생했습니다.")
      console.error("Logout error:", error)
    }
  }

  const handleFormCancel = () => {
    setEditingTodo(null)
    setShowForm(false)
  }

  // AI 요약 생성 함수
  const handleGenerateSummary = async (period: "today" | "week") => {
    setIsLoadingSummary(true)
    setSummaryData(null)

    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "요약 생성에 실패했습니다.")
      }

      const data = await response.json()
      setSummaryData(data)
      toast.success("AI 요약이 생성되었습니다.")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      toast.error(errorMessage)
      console.error("AI 요약 오류:", error)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  // 인증 상태 확인 중이면 로딩 표시
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 사용자 정보가 없으면 리다이렉트 중 (useAuth에서 처리)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <CheckSquareIcon className="size-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">TodoList</h1>
          </div>

          <div className="flex items-center gap-4">
            <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <UserIcon className="size-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>프로필 정보</DialogTitle>
                  <DialogDescription>
                    계정 정보를 확인하고 관리할 수 있습니다
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* 사용자 정보 */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">이메일</Label>
                      <p className="text-sm font-medium mt-1">{user.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">이름</Label>
                      <p className="text-sm font-medium mt-1">{user.name}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* 회원 탈퇴 섹션 */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                        <ShieldAlertIcon className="size-4" />
                        위험한 작업
                      </h4>
                      {!showDeleteAccount ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteAccount(true)}
                          className="w-full"
                        >
                          <TrashIcon className="mr-2 size-4" />
                          회원 탈퇴
                        </Button>
                      ) : (
                        <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                          <Alert variant="destructive">
                            <AlertDescription className="text-xs">
                              회원 탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
                            </AlertDescription>
                          </Alert>
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="delete-email" className="text-sm">
                                이메일 확인
                              </Label>
                              <Input
                                id="delete-email"
                                type="email"
                                placeholder="이메일을 입력하세요"
                                value={deleteEmail}
                                onChange={(e) => setDeleteEmail(e.target.value)}
                                disabled={isDeleting}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="delete-password" className="text-sm">
                                비밀번호 확인
                              </Label>
                              <Input
                                id="delete-password"
                                type="password"
                                placeholder="비밀번호를 입력하세요"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                disabled={isDeleting}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setShowDeleteAccount(false)
                                  setDeleteEmail("")
                                  setDeletePassword("")
                                }}
                                disabled={isDeleting}
                              >
                                취소
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                                onClick={async () => {
                                  if (!deleteEmail || !deletePassword) {
                                    toast.error("이메일과 비밀번호를 모두 입력해주세요.")
                                    return
                                  }

                                  if (deleteEmail !== user.email) {
                                    toast.error("이메일이 일치하지 않습니다.")
                                    return
                                  }

                                  if (!supabase) {
                                    toast.error("Supabase 클라이언트를 초기화할 수 없습니다.")
                                    return
                                  }

                                  // 비밀번호 확인
                                  const { error: signInError } = await supabase.auth.signInWithPassword({
                                    email: deleteEmail,
                                    password: deletePassword,
                                  })

                                  if (signInError) {
                                    toast.error("비밀번호가 올바르지 않습니다.")
                                    return
                                  }

                                  // 확인 대화상자
                                  if (!confirm("정말로 회원 탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                                    return
                                  }

                                  // API를 통해 회원 탈퇴 처리
                                  setIsDeleting(true)
                                  try {
                                    const response = await fetch("/api/auth/delete-account", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        email: deleteEmail,
                                        password: deletePassword,
                                      }),
                                    })

                                    const data = await response.json()

                                    if (!response.ok) {
                                      throw new Error(data.error || "회원 탈퇴에 실패했습니다.")
                                    }

                                    toast.success(data.message || "회원 탈퇴가 완료되었습니다.")
                                    setShowProfileDialog(false)
                                    setShowDeleteAccount(false)
                                    setDeleteEmail("")
                                    setDeletePassword("")
                                    
                                    // 로그인 페이지로 리다이렉트
                                    setTimeout(() => {
                                      window.location.href = "/login"
                                    }, 2000)
                                  } catch (error) {
                                    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
                                    toast.error(errorMessage)
                                    console.error("Delete account error:", error)
                                  } finally {
                                    setIsDeleting(false)
                                  }
                                }}
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                                    처리 중...
                                  </>
                                ) : (
                                  <>
                                    <TrashIcon className="mr-2 size-4" />
                                    회원 탈퇴
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOutIcon className="size-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="mb-6 space-y-4">
          {/* 검색 및 필터 행 */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* 검색창 */}
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="할 일 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 필터 및 정렬 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 우선순위 필터 */}
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as Priority | "all")}
              >
                <SelectTrigger className="w-[140px]">
                  <FilterIcon className="mr-2 size-4" />
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>

              {/* 상태 필터 */}
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as FilterStatus)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="in_progress">진행 중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="overdue">지연</SelectItem>
                </SelectContent>
              </Select>

              {/* 정렬 */}
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDownIcon className="mr-2 size-4" />
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">생성일순</SelectItem>
                  <SelectItem value="due_date">마감일순</SelectItem>
                  <SelectItem value="priority">우선순위순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 할 일 추가 버튼 */}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingTodo(null)
                setShowForm(!showForm)
              }}
              className="gap-2"
            >
              <PlusIcon className="size-4" />
              {showForm ? "폼 닫기" : "할 일 추가"}
            </Button>
          </div>
        </div>

        {/* AI 요약 및 분석 섹션 */}
        <div className="mb-6">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                    <SparklesIcon className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI 요약 및 분석</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      할 일 목록을 분석하여 인사이트와 추천을 제공합니다
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={summaryPeriod} onValueChange={(v) => setSummaryPeriod(v as "today" | "week")}>
                <TabsList className="mb-4">
                  <TabsTrigger value="today">오늘의 요약</TabsTrigger>
                  <TabsTrigger value="week">이번주 요약</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      오늘 예정된 할 일을 분석합니다
                    </p>
                    <Button
                      onClick={() => handleGenerateSummary("today")}
                      disabled={isLoadingSummary}
                      className="gap-2"
                    >
                      {isLoadingSummary ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-4" />
                          AI 요약
                        </>
                      )}
                    </Button>
                  </div>
                  {summaryPeriod === "today" && summaryData && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <TrendingUpIcon className="size-4 text-primary" />
                          요약
                        </h4>
                        <p className="text-sm text-foreground">{summaryData.summary}</p>
                      </div>
                      {summaryData.urgentTasks.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <CheckSquareIcon className="size-4 text-destructive" />
                            긴급한 할 일
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.urgentTasks.map((task, idx) => (
                              <li key={idx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryData.insights.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <LightbulbIcon className="size-4 text-warning" />
                            인사이트
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.insights.map((insight, idx) => (
                              <li key={idx}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryData.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <SparklesIcon className="size-4 text-success" />
                            추천 사항
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="week" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      이번 주 전체 할 일을 분석합니다
                    </p>
                    <Button
                      onClick={() => handleGenerateSummary("week")}
                      disabled={isLoadingSummary}
                      className="gap-2"
                    >
                      {isLoadingSummary ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-4" />
                          AI 요약
                        </>
                      )}
                    </Button>
                  </div>
                  {summaryPeriod === "week" && summaryData && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <TrendingUpIcon className="size-4 text-primary" />
                          요약
                        </h4>
                        <p className="text-sm text-foreground">{summaryData.summary}</p>
                      </div>
                      {summaryData.urgentTasks.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <CheckSquareIcon className="size-4 text-destructive" />
                            긴급한 할 일
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.urgentTasks.map((task, idx) => (
                              <li key={idx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryData.insights.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <LightbulbIcon className="size-4 text-warning" />
                            인사이트
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.insights.map((insight, idx) => (
                              <li key={idx}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryData.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <SparklesIcon className="size-4 text-success" />
                            추천 사항
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                            {summaryData.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Main Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Todo Form (좌측 또는 상단) */}
          <div className={cn(
            "lg:col-span-1 transition-all duration-300 ease-in-out",
            showForm ? "opacity-100" : "opacity-0 pointer-events-none lg:opacity-0"
          )}>
            <div className={cn(
              "sticky top-24 transition-all duration-300 ease-in-out",
              showForm ? "translate-x-0" : "-translate-x-4 lg:translate-x-0"
            )}>
              {showForm && (
                <TodoForm
                  todo={editingTodo}
                  onSubmit={editingTodo ? handleUpdateTodo : handleCreateTodo}
                  onCancel={handleFormCancel}
                />
              )}
            </div>
          </div>

          {/* Todo List (우측 또는 하단) */}
          <div className={cn(
            "transition-all duration-300 ease-in-out",
            showForm ? "lg:col-span-2" : "lg:col-span-3"
          )}>
            {isLoadingTodos ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">할 일 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <TodoList
                todos={filteredAndSortedTodos}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditTodo}
                onDelete={handleDeleteTodo}
                emptyMessage={
                  searchQuery || priorityFilter !== "all" || statusFilter !== "all"
                    ? "검색 결과가 없습니다."
                    : "할 일이 없습니다. 새 할 일을 추가해보세요."
                }
                onAddTodo={() => {
                  setEditingTodo(null)
                  setShowForm(true)
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
