"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, FileTextIcon, TagIcon, FlagIcon, XIcon, SparklesIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { Todo, TodoFormData, Priority } from "./types"

const todoFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(80, "제목은 80자 이하여야 합니다."),
  description: z.string().max(500, "설명은 500자 이하여야 합니다.").optional(),
  due_date: z.date().optional().nullable(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.string().max(30, "카테고리는 30자 이하여야 합니다.").optional().nullable(),
})

type TodoFormValues = z.infer<typeof todoFormSchema>

interface TodoFormProps {
  todo?: Todo | null
  onSubmit: (data: TodoFormData) => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "high", label: "높음" },
  { value: "medium", label: "보통" },
  { value: "low", label: "낮음" },
]

export function TodoForm({
  todo,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: TodoFormProps) {
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [aiInput, setAiInput] = React.useState("")
  const [isParsing, setIsParsing] = React.useState(false)
  const [parseError, setParseError] = React.useState<string | null>(null)
  
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: todo?.title || "",
      description: todo?.description || "",
      due_date: todo?.due_date ? new Date(todo.due_date) : undefined,
      priority: todo?.priority || "medium",
      category: todo?.category || "",
    },
  })

  // AI 자연어 파싱 함수
  const handleParseNaturalLanguage = async () => {
    if (!aiInput.trim()) {
      setParseError("자연어를 입력해주세요.")
      return
    }

    setIsParsing(true)
    setParseError(null)

    try {
      const response = await fetch("/api/ai/parse-todo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ naturalLanguage: aiInput }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "파싱에 실패했습니다.")
      }

      const parsedData = await response.json()

      // 폼에 파싱된 데이터 채우기
      form.setValue("title", parsedData.title)
      if (parsedData.description) {
        form.setValue("description", parsedData.description)
      }
      if (parsedData.due_date) {
        form.setValue("due_date", new Date(parsedData.due_date))
      } else {
        form.setValue("due_date", undefined)
      }
      form.setValue("priority", parsedData.priority)
      if (parsedData.category) {
        form.setValue("category", parsedData.category)
      } else {
        form.setValue("category", "")
      }

      // 성공 메시지 표시 후 입력 필드 초기화
      setAiInput("")
      setParseError(null)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      setParseError(errorMessage)
      console.error("AI 파싱 오류:", error)
    } finally {
      setIsParsing(false)
    }
  }

  const handleSubmit = async (data: TodoFormValues) => {
    const formData: TodoFormData = {
      title: data.title,
      description: data.description || undefined,
      due_date: data.due_date ? data.due_date.toISOString() : null,
      priority: data.priority,
      category: data.category || null,
    }
    await onSubmit(formData)
  }

  return (
    <Card className={cn("shadow-lg border-primary/20", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <FileTextIcon className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {todo ? "할 일 수정" : "새 할 일 추가"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {todo ? "할 일 정보를 수정하세요" : "할 일을 추가하여 생산성을 높이세요"}
              </CardDescription>
            </div>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* AI 자연어 입력 섹션 (새 할 일 추가 시에만 표시) */}
            {!todo && (
              <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="size-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">AI로 할 일 생성</span>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
                      value={aiInput}
                      onChange={(e) => {
                        setAiInput(e.target.value)
                        setParseError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleParseNaturalLanguage()
                        }
                      }}
                      disabled={isParsing || isLoading}
                      className="flex-1 h-10 text-sm"
                    />
                    <Button
                      type="button"
                      onClick={handleParseNaturalLanguage}
                      disabled={isParsing || isLoading || !aiInput.trim()}
                      className="gap-2"
                    >
                      {isParsing ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          <span className="hidden sm:inline">파싱 중...</span>
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-4" />
                          <span className="hidden sm:inline">변환</span>
                        </>
                      )}
                    </Button>
                  </div>
                  {parseError && (
                    <p className="text-xs text-destructive">{parseError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    자연어로 할 일을 입력하면 자동으로 제목, 날짜, 우선순위 등을 추출합니다.
                  </p>
                </div>
              </div>
            )}

            {/* 기본 정보 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-1 rounded-full bg-primary" />
                <span className="text-sm font-semibold text-foreground">기본 정보</span>
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      <span>제목</span>
                      <span className="text-destructive text-xs">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="할 일 제목을 입력하세요"
                        {...field}
                        disabled={isLoading}
                        className="h-11 text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      최대 80자까지 입력할 수 있습니다
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">설명</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="상세 설명을 입력하세요 (선택사항)"
                        {...field}
                        value={field.value || ""}
                        disabled={isLoading}
                        rows={4}
                        className="resize-none text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      최대 500자까지 입력할 수 있습니다
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* 일정 및 우선순위 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-1 rounded-full bg-primary" />
                <span className="text-sm font-semibold text-foreground">일정 및 우선순위</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        <span>마감일</span>
                      </FormLabel>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-11",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={isLoading}
                              type="button"
                            >
                              <CalendarIcon className="mr-2 size-4" />
                              {field.value ? (
                                format(field.value, "yyyy년 MM월 dd일", { locale: ko })
                              ) : (
                                <span>날짜 선택</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={(date) => {
                              field.onChange(date)
                              setCalendarOpen(false)
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription className="text-xs">
                        선택사항
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <FlagIcon className="size-4 text-muted-foreground" />
                        <span>우선순위</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="우선순위 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        할 일의 중요도를 선택하세요
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* 카테고리 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-1 rounded-full bg-primary" />
                <span className="text-sm font-semibold text-foreground">분류</span>
              </div>

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      <TagIcon className="size-4 text-muted-foreground" />
                      <span>카테고리</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예: 업무, 개인, 학습"
                        {...field}
                        value={field.value || ""}
                        disabled={isLoading}
                        className="h-11 text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      선택사항, 최대 30자
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="min-w-[100px]"
                >
                  취소
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={isLoading}
                className="min-w-[100px]"
              >
                {isLoading ? "저장 중..." : todo ? "수정하기" : "추가하기"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

