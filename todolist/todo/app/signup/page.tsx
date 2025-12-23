"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const signupFormSchema = z
  .object({
    email: z.string().email("올바른 이메일 주소를 입력해주세요."),
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        "비밀번호는 영문과 숫자를 포함해야 합니다."
      ),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type SignupFormValues = z.infer<typeof signupFormSchema>

export default function SignupPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, supabase } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [showEmailConfirmation, setShowEmailConfirmation] = React.useState(false)
  const [userEmail, setUserEmail] = React.useState("")

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  // 이미 로그인된 경우 메인 페이지로 리다이렉트
  React.useEffect(() => {
    if (!authLoading && user) {
      router.push("/")
      router.refresh()
    }
  }, [user, authLoading, router])

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

  const getErrorMessage = (error: { message?: string } | null): string => {
    if (!error) return "회원가입에 실패했습니다."

    const errorMessage = error.message?.toLowerCase() || ""

    // 이미 가입된 이메일
    if (
      errorMessage.includes("already registered") ||
      errorMessage.includes("user already registered") ||
      errorMessage.includes("이미")
    ) {
      return "이미 가입된 이메일입니다."
    }

    // 약한 비밀번호
    if (errorMessage.includes("password") && errorMessage.includes("weak")) {
      return "비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요."
    }

    // 이메일 형식 오류
    if (errorMessage.includes("email") || errorMessage.includes("invalid")) {
      return "올바른 이메일 주소를 입력해주세요."
    }

    // 네트워크 오류
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요."
    }

    // 기타 오류는 원본 메시지 반환 (한국어로 변환 가능한 경우)
    return error.message || "회원가입에 실패했습니다. 다시 시도해주세요."
  }

  const onSubmit = async (data: SignupFormValues) => {
    if (!supabase) {
      toast.error("Supabase 클라이언트를 초기화할 수 없습니다. 환경변수를 확인해주세요.")
      return
    }

    setIsLoading(true)
    setShowEmailConfirmation(false)
    
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        const errorMessage = getErrorMessage(error)
        toast.error(errorMessage)
        form.setError("root", { message: errorMessage })
        return
      }

      // 성공 처리
      if (authData.user) {
        setUserEmail(data.email)
        
        // 이메일 확인이 필요한 경우 (Supabase 설정에 따라)
        if (authData.user.identities && authData.user.identities.length === 0) {
          // 이메일 확인 대기 중
          setShowEmailConfirmation(true)
          toast.success("회원가입이 완료되었습니다!")
        } else {
          // 즉시 로그인 가능한 경우
          toast.success("회원가입에 성공했습니다!")
          router.push("/login")
        }
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error)
      toast.error(errorMessage)
      form.setError("root", { message: errorMessage })
      console.error("Signup error:", error)
    } finally {
      setIsLoading(false)
    }
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

        {/* 회원가입 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>회원가입</CardTitle>
            <CardDescription>
              계정을 생성하여 시작하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* 이메일 확인 안내 메시지 */}
                {showEmailConfirmation && (
                  <Alert className="bg-primary/10 border-primary/20">
                    <MailIcon className="size-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong className="font-semibold">이메일 확인이 필요합니다.</strong>
                      <br />
                      <span className="text-muted-foreground">
                        {userEmail}로 확인 메일을 보냈습니다.
                        <br />
                        메일함을 확인하고 링크를 클릭하여 계정을 활성화해주세요.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* 전역 오류 메시지 */}
                {form.formState.errors.root && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {form.formState.errors.root.message}
                    </AlertDescription>
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
                          disabled={isLoading || showEmailConfirmation}
                          {...field}
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
                          disabled={isLoading || showEmailConfirmation}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        최소 8자 이상, 영문과 숫자를 포함해주세요
                      </FormDescription>
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
                          disabled={isLoading || showEmailConfirmation}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showEmailConfirmation ? (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowEmailConfirmation(false)
                        form.reset()
                      }}
                    >
                      다른 이메일로 가입하기
                    </Button>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => router.push("/login")}
                    >
                      로그인 페이지로 이동
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      "회원가입"
                    )}
                  </Button>
                )}
              </form>
            </Form>

            {/* 로그인 및 비밀번호 찾기 링크 */}
            <div className="mt-6 space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <Link
                  href="/login"
                  className="text-primary font-medium hover:underline"
                >
                  로그인
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                비밀번호를 잊으셨나요?{" "}
                <Link
                  href="/login"
                  className="text-primary font-medium hover:underline"
                >
                  비밀번호 찾기
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 추가 정보 */}
        <p className="text-xs text-center text-muted-foreground mt-6">
          회원가입 후 AI 기반 할 일 관리의 모든 기능을 이용하실 수 있습니다
        </p>
      </div>
    </div>
  )
}

