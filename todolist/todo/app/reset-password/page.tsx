"use client"

import * as React from "react"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckSquareIcon, Loader2Icon, LockIcon } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const resetPasswordFormSchema = z
  .object({
    password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
    confirmPassword: z.string().min(8, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>

function ResetPasswordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isInitializing, setIsInitializing] = React.useState(true)
  const supabase = React.useMemo(() => createClient(), [])

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  // URL hash fragment 및 query parameter에서 토큰 처리 및 세션 복원
  React.useEffect(() => {
    const initializeSession = async () => {
      try {
        // URL hash fragment에서 토큰 확인
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        const type = hashParams.get("type")

        // Query parameter에서도 확인 (일부 경우)
        const queryParams = new URLSearchParams(window.location.search)
        const queryAccessToken = queryParams.get("access_token")
        const queryType = queryParams.get("type")

        // 비밀번호 재설정 토큰인 경우
        const token = accessToken || queryAccessToken
        const tokenType = type || queryType

        if (token && tokenType === "recovery") {
          // 세션 복원
          const { data: { session }, error: sessionError } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken || hashParams.get("refresh_token") || "",
          })

          if (sessionError) {
            console.error("Session restoration error:", sessionError)
            
            // 세션 복원 실패 시 더 자세한 오류 메시지
            let errorMsg = "비밀번호 재설정 링크를 처리하는 중 오류가 발생했습니다."
            if (sessionError.message?.includes("expired") || sessionError.message?.includes("invalid")) {
              errorMsg = "비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 새로운 링크를 요청해주세요."
            }
            
            setErrorMessage(errorMsg)
            toast.error(errorMsg)
            setIsInitializing(false)
            return
          }

          // 세션 복원 성공 확인
          if (!session) {
            setErrorMessage("세션을 복원할 수 없습니다. 새로운 비밀번호 재설정 링크를 요청해주세요.")
            toast.error("세션을 복원할 수 없습니다. 새로운 비밀번호 재설정 링크를 요청해주세요.")
            setIsInitializing(false)
            return
          }

          // URL에서 hash fragment 및 query parameter 제거
          window.history.replaceState({}, "", window.location.pathname)
        } else {
          // 토큰이 없는 경우 기존 세션 확인
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError || !session) {
            // 세션이 없으면 오류 메시지 표시
            setErrorMessage("비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다. 새로운 링크를 요청해주세요.")
            toast.error("비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다. 새로운 링크를 요청해주세요.")
            setIsInitializing(false)
            return
          }
        }

        setIsInitializing(false)
      } catch (error) {
        console.error("Initialization error:", error)
        setErrorMessage("비밀번호 재설정 링크를 처리하는 중 오류가 발생했습니다.")
        toast.error("비밀번호 재설정 링크를 처리하는 중 오류가 발생했습니다.")
        setIsInitializing(false)
      }
    }

    initializeSession()
  }, [supabase])

  // URL 파라미터에서 오류 확인
  React.useEffect(() => {
    const error = searchParams.get("error")
    const errorCode = searchParams.get("error_code")
    const errorDescription = searchParams.get("error_description")

    if (error || errorCode) {
      let friendlyMessage = "비밀번호 재설정 링크에 문제가 있습니다."

      if (errorCode === "otp_expired" || errorCode === "token_expired") {
        friendlyMessage = "비밀번호 재설정 링크가 만료되었습니다. 새로운 링크를 요청해주세요."
      } else if (error === "access_denied") {
        friendlyMessage = "비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다. 새로운 링크를 요청해주세요."
      } else if (errorDescription) {
        friendlyMessage = errorDescription
      }

      setErrorMessage(friendlyMessage)
      toast.error(friendlyMessage)
      setIsInitializing(false)
    }
  }, [searchParams])

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!supabase) {
      toast.error("Supabase 클라이언트를 초기화할 수 없습니다.")
      return
    }

    // 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      setErrorMessage("세션이 만료되었습니다. 비밀번호 재설정 링크를 다시 요청해주세요.")
      toast.error("세션이 만료되었습니다. 비밀번호 재설정 링크를 다시 요청해주세요.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (updateError) {
        throw updateError
      }

      setIsSuccess(true)
      toast.success("비밀번호가 성공적으로 변경되었습니다.")

      // 세션 종료 (보안을 위해)
      await supabase.auth.signOut()

      // 2초 후 로그인 페이지로 리다이렉트
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "비밀번호 재설정에 실패했습니다."
      setErrorMessage(errorMessage)
      toast.error(errorMessage)
      console.error("Reset password error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckSquareIcon className="size-6 text-primary" />
            </div>
            <CardTitle>비밀번호 재설정 완료</CardTitle>
            <CardDescription>비밀번호가 성공적으로 변경되었습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription>
                  로그인 페이지로 이동합니다...
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                로그인 페이지로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 초기화 중일 때 로딩 표시
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">비밀번호 재설정 링크를 확인하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 로고 및 제목 */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <CheckSquareIcon className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
          <p className="text-muted-foreground">
            새로운 비밀번호를 입력해주세요
          </p>
        </div>

        {/* 비밀번호 재설정 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>새 비밀번호 설정</CardTitle>
            <CardDescription>
              안전한 비밀번호를 입력해주세요 (최소 8자 이상)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* 오류 메시지 표시 */}
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>새 비밀번호</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="새 비밀번호를 입력하세요"
                          disabled={isLoading}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setErrorMessage(null)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호 확인</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="비밀번호를 다시 입력하세요"
                          disabled={isLoading}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setErrorMessage(null)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      비밀번호 변경 중...
                    </>
                  ) : (
                    <>
                      <LockIcon className="mr-2 size-4" />
                      비밀번호 변경
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* 로그인 링크 */}
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-sm text-primary hover:underline"
              >
                로그인 페이지로 돌아가기
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    }>
      <ResetPasswordPageContent />
    </Suspense>
  )
}

