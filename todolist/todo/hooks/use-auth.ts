"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthUser {
  id: string
  email: string
  name?: string
}

export function useAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  const supabase = React.useMemo(() => {
    try {
      return createClient()
    } catch (error) {
      console.error("Supabase client creation error:", error)
      return null
    }
  }, [])

  // 인증 상태 확인 및 리다이렉트 처리
  React.useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    const checkAuth = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error) {
          // AuthSessionMissingError는 정상적인 플로우 (로그인하지 않은 상태)
          // 다른 에러만 로깅
          if (error.name !== "AuthSessionMissingError") {
            console.error("Auth error:", error)
          }
          setUser(null)
          // 로그인 페이지가 아닌 경우 리다이렉트
          if (pathname !== "/login" && pathname !== "/signup") {
            router.push("/login")
          }
          setIsLoading(false)
          return
        }

        if (authUser) {
          // public.users 테이블에서 사용자 존재 여부 확인
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("id", authUser.id)
            .single()

          if (userError || !userData) {
            // public.users에 사용자가 없으면 탈퇴한 계정 - 로그아웃 처리
            await supabase.auth.signOut()
            setUser(null)
            if (pathname !== "/login" && pathname !== "/signup") {
              router.push("/login")
            }
            setIsLoading(false)
            return
          }

          setUser({
            id: authUser.id,
            email: authUser.email || "",
            name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "사용자",
          })

          // 로그인 페이지나 회원가입 페이지에 있으면 메인으로 리다이렉트
          if (pathname === "/login" || pathname === "/signup") {
            router.push("/")
            router.refresh()
          }
        } else {
          setUser(null)
          // 보호된 페이지인 경우 로그인 페이지로 리다이렉트
          if (pathname !== "/login" && pathname !== "/signup") {
            router.push("/login")
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error)
        setUser(null)
        if (pathname !== "/login" && pathname !== "/signup") {
          router.push("/login")
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // 인증 상태 변화 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          // public.users 테이블에서 사용자 존재 여부 확인
          supabase
            .from("users")
            .select("id")
            .eq("id", session.user.id)
            .single()
            .then(({ data: userData, error: userError }) => {
              if (userError || !userData) {
                // public.users에 사용자가 없으면 탈퇴한 계정 - 로그아웃 처리
                supabase.auth.signOut()
                setUser(null)
                if (pathname !== "/login" && pathname !== "/signup") {
                  router.push("/login")
                }
                setIsLoading(false)
                return
              }

              setUser({
                id: session.user.id,
                email: session.user.email || "",
                name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "사용자",
              })
              setIsLoading(false)
              // 로그인 성공 시 메인 페이지로 리다이렉트
              if (pathname === "/login" || pathname === "/signup") {
                router.push("/")
                router.refresh()
              }
            })
        } else if (event === "SIGNED_OUT") {
          setUser(null)
          setIsLoading(false)
          // 로그아웃 시 로그인 페이지로 리다이렉트
          if (pathname !== "/login" && pathname !== "/signup") {
            router.push("/login")
            router.refresh()
          }
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // 토큰 갱신 시 public.users 테이블 확인
          supabase
            .from("users")
            .select("id")
            .eq("id", session.user.id)
            .single()
            .then(({ data: userData, error: userError }) => {
              if (userError || !userData) {
                // public.users에 사용자가 없으면 탈퇴한 계정 - 로그아웃 처리
                supabase.auth.signOut()
                setUser(null)
                if (pathname !== "/login" && pathname !== "/signup") {
                  router.push("/login")
                }
                return
              }

              // 사용자 정보 업데이트
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "사용자",
              })
            })
        } else if (event === "INITIAL_SESSION") {
          // 초기 세션 확인 (에러 없이 처리)
          if (session?.user) {
            // public.users 테이블에서 사용자 존재 여부 확인
            supabase
              .from("users")
              .select("id")
              .eq("id", session.user.id)
              .single()
              .then(({ data: userData, error: userError }) => {
                if (userError || !userData) {
                  // public.users에 사용자가 없으면 탈퇴한 계정 - 로그아웃 처리
                  supabase.auth.signOut()
                  setUser(null)
                  setIsLoading(false)
                  return
                }

                setUser({
                  id: session.user.id,
                  email: session.user.email || "",
                  name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "사용자",
                })
                setIsLoading(false)
              })
          } else {
            setUser(null)
            setIsLoading(false)
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

  const signOut = async () => {
    if (!supabase) {
      return { error: new Error("Supabase client not available") }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    user,
    isLoading,
    signOut,
    supabase,
  }
}

