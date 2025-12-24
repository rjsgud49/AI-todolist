import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // 요청 본문 파싱
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      )
    }

    const { email, password } = body as { email: string; password?: string }

    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 }
      )
    }

    // 서비스 역할 키로 Admin 클라이언트 생성
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "서비스 역할 키가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 이메일로 사용자 찾기
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error("사용자 목록 조회 오류:", listError)
      return NextResponse.json(
        { error: "사용자 정보를 조회할 수 없습니다." },
        { status: 500 }
      )
    }

    const existingUser = users.users.find(u => u.email === email)

    if (!existingUser) {
      return NextResponse.json({
        success: true,
        deleted: false,
        message: "계정이 없습니다. 회원가입을 진행할 수 있습니다.",
      })
    }

    // 이메일이 확인되지 않은 계정이거나 탈퇴된 계정인 경우 삭제
    if (!existingUser.email_confirmed_at && !existingUser.confirmed_at) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
      
      if (deleteError) {
        console.error("계정 삭제 오류:", deleteError)
        return NextResponse.json(
          { error: "탈퇴된 계정 삭제에 실패했습니다." },
          { status: 500 }
        )
      }

      // 비밀번호가 제공된 경우, 서버 측에서 회원가입 시도
      if (password) {
        // 일반 클라이언트로 회원가입 시도 (이메일 전송을 위해)
        const supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )

        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login`,
          },
        })

        if (signUpError) {
          console.error("회원가입 오류:", signUpError)
          return NextResponse.json({
            success: true,
            deleted: true,
            signUpError: signUpError.message,
            message: "계정을 삭제했습니다. 클라이언트에서 다시 회원가입을 시도해주세요.",
          })
        }

        // 회원가입 후 이메일이 자동으로 전송되어야 함
        // Supabase 설정에서 이메일 확인이 활성화되어 있는지 확인 필요
        console.log("회원가입 완료 - 이메일 전송 대기 중:", email)

        return NextResponse.json({
          success: true,
          deleted: true,
          user: signUpData.user,
          needsEmailConfirmation: !signUpData.user?.email_confirmed_at && !signUpData.user?.confirmed_at,
          message: "회원가입이 완료되었습니다. 이메일 확인 메일을 확인해주세요.",
        })
      }

      return NextResponse.json({
        success: true,
        deleted: true,
        message: "탈퇴된 계정을 삭제했습니다. 다시 회원가입을 시도해주세요.",
      })
    }

    // 이미 확인된 활성 계정
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다. 로그인해주세요." },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error("Delete account for signup error:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    
    return NextResponse.json(
      { error: `계정 처리 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

