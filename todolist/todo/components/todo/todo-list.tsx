"use client"

import * as React from "react"
import { CheckSquareIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { TodoCard } from "./todo-card"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import type { Todo } from "./types"

interface TodoListProps {
  todos: Todo[]
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (todo: Todo) => void
  onDelete?: (id: string) => void
  className?: string
  emptyMessage?: string
  onAddTodo?: () => void
}

export function TodoList({
  todos,
  onToggleComplete,
  onEdit,
  onDelete,
  className,
  emptyMessage = "할 일이 없습니다. 새 할 일을 추가해보세요.",
  onAddTodo,
}: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-16 px-4", className)}>
        <Empty className="max-w-md border-2 border-dashed bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="mb-4">
              <CheckSquareIcon className="size-12 text-muted-foreground/50" />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-semibold text-foreground">
              할 일이 없습니다
            </EmptyTitle>
            <EmptyDescription className="mt-2 text-base">
              {emptyMessage}
            </EmptyDescription>
          </EmptyHeader>
          {onAddTodo && (
            <Button
              onClick={onAddTodo}
              className="mt-6 gap-2"
              size="lg"
            >
              <PlusIcon className="size-4" />
              할 일 추가하기
            </Button>
          )}
        </Empty>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

