"use client"

import * as React from "react"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckSquareIcon, Loader2Icon, MailIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
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

const loginFormSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
})
 
type LoginFormValues = z.infer<typeof loginFormSchema>

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, supabase } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [showPasswordReset, setShowPasswordReset] = React.useState(false)
  const [resetEmail, setResetEmail] = React.useState("")
  const [isResetting, setIsResetting] = React.useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = React.useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // URL 파라미터에서 오류 및 성공 메시지 확인
  React.useEffect(() => {
    const error = searchParams.get("error")
    const errorCode = searchParams.get("error_code")
    const errorDescription = searchParams.get("error_description")
    const reset = searchParams.get("reset")

    if (error || errorCode) {
      // URL 오류 파라미터 처리
      let friendlyMessage = "비밀번호 재설정 링크에 문제가 있습니다."

      if (errorCode === "otp_expired") {
        friendlyMessage = "비밀번호 재설정 링크가 만료되었습니다. 새로운 링크를 요청해주세요."
      } else if (errorCode === "token_expired") {
        friendlyMessage = "비밀번호 재설정 링크가 만료되었습니다. 새로운 링크를 요청해주세요."
      } else if (error === "access_denied") {
        friendlyMessage = "비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다. 새로운 링크를 요청해주세요."
      }

      setErrorMessage(friendlyMessage)
      toast.error(friendlyMessage)
      setShowPasswordReset(true)

      // URL 정리 (오류 파라미터 제거)
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    } else if (reset === "true") {
      // 비밀번호 재설정 성공
      setResetSuccessMessage("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.")
      toast.success("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.")
      setShowPasswordReset(true)

      // URL 정리
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [searchParams])

  // 이미 로그인된 경우 메인 페이지로 리다이렉트 (useAuth에서 처리되지만 추가 확인)
  React.useEffect(() => {
    if (!authLoading && user) {
      router.push("/")
      router.refresh()
    }
  }, [user, authLoading, router])

  const getErrorMessage = (error: { message?: string } | null): string => {
    if (!error) return "로그인에 실패했습니다."

    const errorMessage = error.message?.toLowerCase() || ""

    // 잘못된 이메일 또는 비밀번호
    if (
      errorMessage.includes("invalid login") ||
      errorMessage.includes("invalid credentials") ||
      errorMessage.includes("email") && errorMessage.includes("password") ||
      errorMessage.includes("wrong") ||
      errorMessage.includes("incorrect")
    ) {
      return "이메일 또는 비밀번호가 올바르지 않습니다."
    }

    // 이메일 확인 필요
    if (
      errorMessage.includes("email not confirmed") ||
      errorMessage.includes("email_not_confirmed")
    ) {
      return "이메일 확인이 필요합니다. 메일함을 확인해주세요."
    }

    // 계정 비활성화
    if (errorMessage.includes("disabled") || errorMessage.includes("banned")) {
      return "계정이 비활성화되었습니다. 관리자에게 문의해주세요."
    }

    // 네트워크 오류
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요."
    }

    // 기타 오류
    return error.message || "로그인에 실패했습니다. 다시 시도해주세요."
  }

  const onSubmit = async (data: LoginFormValues) => {
    if (!supabase) {
      toast.error("Supabase 클라이언트를 초기화할 수 없습니다. 환경변수를 확인해주세요.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        const errorMsg = getErrorMessage(error)
        setErrorMessage(errorMsg)
        toast.error(errorMsg)
        return
      }

      // 로그인 성공
      if (authData.user) {
        // public.users 테이블에서 사용자 존재 여부 확인
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("id", authData.user.id)
          .single()

        if (userError || !userData) {
          // public.users에 사용자가 없으면 탈퇴한 계정
          await supabase.auth.signOut()
          const errorMsg = "탈퇴한 계정입니다. 회원가입을 다시 진행해주세요."
          setErrorMessage(errorMsg)
          toast.error(errorMsg)
          return
        }

        toast.success("로그인에 성공했습니다!")
        router.push("/")
        router.refresh() // 세션 정보 갱신
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error as { message?: string } | null)
      setErrorMessage(errorMsg)
      toast.error(errorMsg)
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 인증 상태 확인 중이면 로딩 표시
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* 서비스 로고 및 소개 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-4">
            <CheckSquareIcon className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">TodoList</h1>
          <p className="text-muted-foreground">
            AI 기반 할 일 관리로 더 스마트하게
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            자연어로 할 일을 입력하고, AI가 자동으로 구조화해드립니다
          </p>
        </div>

        {/* 로그인 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>
              이메일과 비밀번호를 입력하여 로그인하세요
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="example@email.com"
                          disabled={isLoading}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setErrorMessage(null) // 입력 시 오류 메시지 제거
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="비밀번호를 입력하세요"
                          disabled={isLoading}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setErrorMessage(null) // 입력 시 오류 메시지 제거
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
                      로그인 중...
                    </>
                  ) : (
                    "로그인"
                  )}
                </Button>
              </form>
            </Form>

            {/* 비밀번호 찾기 */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-sm text-primary hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>

            {/* 비밀번호 재설정 다이얼로그 */}
            {showPasswordReset && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2">비밀번호 재설정</h3>
                {resetSuccessMessage ? (
                  <Alert className="mb-4 bg-primary/10 border-primary/20">
                    <MailIcon className="size-4 text-primary" />
                    <AlertDescription className="text-sm">
                      {resetSuccessMessage}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                  </p>
                )}
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="이메일 주소를 입력하세요"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={isResetting}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowPasswordReset(false)
                        setResetEmail("")
                      }}
                      disabled={isResetting}
                    >
                      취소
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={async () => {
                        if (!resetEmail || !resetEmail.includes("@")) {
                          toast.error("올바른 이메일 주소를 입력해주세요.")
                          return
                        }

                        if (!supabase) {
                          toast.error("Supabase 클라이언트를 초기화할 수 없습니다.")
                          return
                        }

                        setIsResetting(true)
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          })

                          if (error) {
                            toast.error(error.message || "비밀번호 재설정 메일 전송에 실패했습니다.")
                            return
                          }

                          toast.success("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.")
                          setResetSuccessMessage("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.")
                          setResetEmail("")
                          // 3초 후 폼 닫기
                          setTimeout(() => {
                            setShowPasswordReset(false)
                            setResetSuccessMessage(null)
                          }, 3000)
                        } catch (error) {
                          toast.error("비밀번호 재설정 메일 전송에 실패했습니다.")
                          console.error("Password reset error:", error)
                        } finally {
                          setIsResetting(false)
                        }
                      }}
                      disabled={isResetting}
                    >
                      {isResetting ? (
                        <>
                          <Loader2Icon className="mr-2 size-4 animate-spin" />
                          전송 중...
                        </>
                      ) : (
                        <>
                          <MailIcon className="mr-2 size-4" />
                          메일 보내기
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 회원가입 링크 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                계정이 없으신가요?{" "}
                <Link
                  href="/signup"
                  className="text-primary font-medium hover:underline"
                >
                  회원가입
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 추가 정보 */}
        <p className="text-xs text-center text-muted-foreground mt-6">
          로그인하면 할 일 관리 서비스의 모든 기능을 이용하실 수 있습니다
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2Icon className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

