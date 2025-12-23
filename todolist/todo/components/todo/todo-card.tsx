"use client"

import * as React from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CheckIcon, EditIcon, TrashIcon, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
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
  const status = getTodoStatus(todo)
  const priorityInfo = priorityConfig[todo.priority]
  const statusInfo = statusConfig[status]

  const handleToggleComplete = (checked: boolean) => {
    onToggleComplete?.(todo.id, checked)
  }

  const handleEdit = () => {
    onEdit?.(todo)
  }

  const handleDelete = () => {
    if (confirm("정말 이 할 일을 삭제하시겠습니까?")) {
      onDelete?.(todo.id)
    }
  }

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-lg hover:border-primary/30 group",
        todo.completed && "opacity-60 bg-muted/30",
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={handleToggleComplete}
            className="mt-1.5 size-5"
            aria-label={todo.completed ? "완료 취소" : "완료"}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  "font-semibold text-lg leading-snug pr-2",
                  todo.completed && "line-through text-muted-foreground"
                )}
              >
                {todo.title}
              </h3>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleEdit}
                  aria-label="수정"
                  className="h-8 w-8"
                >
                  <EditIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDelete}
                  aria-label="삭제"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </div>
            {todo.description && (
              <p
                className={cn(
                  "text-sm text-muted-foreground leading-relaxed line-clamp-2",
                  todo.completed && "line-through"
                )}
              >
                {todo.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* 메타 정보 배지 */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium border-2 px-2.5 py-0.5",
              priorityInfo.className
            )}
          >
            {priorityInfo.label}
          </Badge>
          {todo.category && (
            <Badge 
              variant="outline" 
              className="text-xs font-medium border border-border bg-background"
            >
              {todo.category}
            </Badge>
          )}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium border",
              status === "completed" && "bg-success/10 border-success/20 text-success",
              status === "overdue" && "bg-destructive/10 border-destructive/20 text-destructive",
              status === "in_progress" && "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]"
            )}
          >
            {statusInfo.label}
          </Badge>
        </div>

        {/* 하단 정보 */}
        <div className="flex items-center justify-between pt-2 border-t">
          {todo.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md",
                status === "overdue" && "bg-destructive/10 text-destructive",
                status === "in_progress" && new Date(todo.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) && "bg-warning/10 text-warning",
                !todo.completed && status !== "overdue" && new Date(todo.due_date) >= new Date(Date.now() + 24 * 60 * 60 * 1000) && "text-muted-foreground"
              )}>
                <CalendarIcon className="size-4" />
                <span className="font-medium">
                  {format(new Date(todo.due_date), "yyyy년 MM월 dd일", {
                    locale: ko,
                  })}
                </span>
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {format(new Date(todo.created_date), "MM월 dd일 생성", {
              locale: ko,
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

