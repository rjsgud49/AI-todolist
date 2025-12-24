"use client"

import * as React from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CheckIcon, EditIcon, TrashIcon, CalendarIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { Todo, Priority, TodoStatus } from "./types"

interface TodoCardProps {
  todo: Todo
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (todo: Todo) => void
  onDelete?: (id: string) => void
  className?: string
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: "높음", className: "bg-destructive text-white border-destructive" },
  medium: { label: "보통", className: "bg-warning text-white border-warning" },
  low: { label: "낮음", className: "bg-[#6B7280] text-white border-[#6B7280]" },
}

const statusConfig: Record<TodoStatus, { label: string; className: string }> = {
  completed: { label: "완료", className: "text-success" },
  overdue: { label: "지연", className: "text-destructive" },
  in_progress: { label: "진행 중", className: "text-[#3B82F6]" }, // Blue-500 for AI/in-progress
}

function getTodoStatus(todo: Todo): TodoStatus {
  if (todo.completed) {
    return "completed"
  }
  if (todo.due_date) {
    const dueDate = new Date(todo.due_date)
    const now = new Date()
    if (dueDate < now) {
      return "overdue"
    }
  }
  return "in_progress"
}

export function TodoCard({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
  className,
}: TodoCardProps) {
  const [showDetail, setShowDetail] = React.useState(false)
  const status = getTodoStatus(todo)
  const priorityInfo = priorityConfig[todo.priority]
  const statusInfo = statusConfig[status]

  const handleToggleComplete = (checked: boolean) => {
    onToggleComplete?.(todo.id, checked)
  }

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    onEdit?.(todo)
  }

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (confirm("정말 이 할 일을 삭제하시겠습니까?")) {
      onDelete?.(todo.id)
    }
  }

  const handleCardClick = () => {
    setShowDetail(true)
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <>
      <Card
        onClick={handleCardClick}
        className={cn(
          "transition-all hover:shadow-md hover:border-primary/30 group cursor-pointer h-full",
          todo.completed && "opacity-60 bg-muted/30",
          className
        )}
      >
        <CardHeader className="pb-2 px-3.5 pt-3">
          <div className="flex items-start gap-2">
            <div onClick={handleCheckboxClick}>
              <Checkbox
                checked={todo.completed}
                onCheckedChange={handleToggleComplete}
                className="mt-0.5 size-4"
                aria-label={todo.completed ? "완료 취소" : "완료"}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3
                  className={cn(
                    "font-medium text-sm leading-snug pr-1 flex-1",
                    todo.completed && "line-through text-muted-foreground"
                  )}
                >
                  {todo.title}
                </h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleEdit}
                    aria-label="수정"
                    className="h-6 w-6"
                  >
                    <EditIcon className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleDelete}
                    aria-label="삭제"
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <TrashIcon className="size-3" />
                  </Button>
                </div>
              </div>
              {todo.description && (
                <p
                  className={cn(
                    "text-xs text-muted-foreground leading-relaxed line-clamp-2",
                    todo.completed && "line-through"
                  )}
                >
                  {todo.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3.5 pb-2.5 space-y-2">
          {/* 메타 정보 배지 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] font-medium border px-1.5 py-0.5 leading-tight",
                priorityInfo.className
              )}
            >
              {priorityInfo.label}
            </Badge>
            {todo.category && (
              <Badge 
                variant="outline" 
                className="text-[10px] font-medium border border-border bg-background px-1.5 py-0.5 leading-tight"
              >
                {todo.category}
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] font-medium border px-1.5 py-0.5 leading-tight",
                status === "completed" && "bg-success/10 border-success/20 text-success",
                status === "overdue" && "bg-destructive/10 border-destructive/20 text-destructive",
                status === "in_progress" && "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]"
              )}
            >
              {statusInfo.label}
            </Badge>
          </div>

          {/* 하단 정보 */}
          {todo.due_date && (
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarIcon className="size-3 text-muted-foreground" />
              <span className={cn(
                "font-medium",
                status === "overdue" && "text-destructive",
                status === "in_progress" && new Date(todo.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) && "text-warning",
                !todo.completed && status !== "overdue" && new Date(todo.due_date) >= new Date(Date.now() + 24 * 60 * 60 * 1000) && "text-muted-foreground"
              )}>
                {format(new Date(todo.due_date), "MM/dd", {
                  locale: ko,
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세 정보 다이얼로그 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className={cn(
                  "text-2xl font-bold mb-2",
                  todo.completed && "line-through text-muted-foreground"
                )}>
                  {todo.title}
                </DialogTitle>
                <DialogDescription>
                  할 일 상세 정보
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDetail(false)
                    handleEdit()
                  }}
                  className="gap-2"
                >
                  <EditIcon className="size-4" />
                  수정
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setShowDetail(false)
                    handleDelete()
                  }}
                  className="gap-2"
                >
                  <TrashIcon className="size-4" />
                  삭제
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 상태 및 우선순위 */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-sm font-medium border-2 px-3 py-1",
                  priorityInfo.className
                )}
              >
                우선순위: {priorityInfo.label}
              </Badge>
              {todo.category && (
                <Badge 
                  variant="outline" 
                  className="text-sm font-medium border border-border bg-background px-3 py-1"
                >
                  카테고리: {todo.category}
                </Badge>
              )}
              <Badge 
                variant="outline" 
                className={cn(
                  "text-sm font-medium border px-3 py-1",
                  status === "completed" && "bg-success/10 border-success/20 text-success",
                  status === "overdue" && "bg-destructive/10 border-destructive/20 text-destructive",
                  status === "in_progress" && "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]"
                )}
              >
                상태: {statusInfo.label}
              </Badge>
              <div className="flex items-center gap-2 ml-auto">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={handleToggleComplete}
                  className="size-5"
                  aria-label={todo.completed ? "완료 취소" : "완료"}
                />
                <span className="text-sm font-medium">
                  {todo.completed ? "완료됨" : "미완료"}
                </span>
              </div>
            </div>

            <Separator />

            {/* 설명 */}
            {todo.description ? (
              <div>
                <h4 className="text-sm font-semibold mb-2">설명</h4>
                <p className={cn(
                  "text-sm text-foreground leading-relaxed whitespace-pre-wrap",
                  todo.completed && "line-through text-muted-foreground"
                )}>
                  {todo.description}
                </p>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-semibold mb-2">설명</h4>
                <p className="text-sm text-muted-foreground">설명이 없습니다.</p>
              </div>
            )}

            <Separator />

            {/* 날짜 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todo.due_date && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CalendarIcon className="size-4" />
                    마감일
                  </h4>
                  <div className={cn(
                    "text-sm px-3 py-2 rounded-md",
                    status === "overdue" && "bg-destructive/10 text-destructive",
                    status === "in_progress" && new Date(todo.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) && "bg-warning/10 text-warning",
                    !todo.completed && status !== "overdue" && new Date(todo.due_date) >= new Date(Date.now() + 24 * 60 * 60 * 1000) && "bg-muted text-foreground"
                  )}>
                    {format(new Date(todo.due_date), "yyyy년 MM월 dd일 (EEEE)", {
                      locale: ko,
                    })}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">생성일</h4>
                <div className="text-sm px-3 py-2 rounded-md bg-muted">
                  {format(new Date(todo.created_date), "yyyy년 MM월 dd일 HH:mm", {
                    locale: ko,
                  })}
                </div>
              </div>
              {todo.updated_at && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">수정일</h4>
                  <div className="text-sm px-3 py-2 rounded-md bg-muted">
                    {format(new Date(todo.updated_at), "yyyy년 MM월 dd일 HH:mm", {
                      locale: ko,
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

