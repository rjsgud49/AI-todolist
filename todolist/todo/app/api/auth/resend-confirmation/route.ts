import { createRouteHandlerClient } from "@/lib/supabase/server"
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

    const { email } = body as { email: string }

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

    const user = users.users.find(u => u.email === email)

    if (!user) {
      return NextResponse.json(
        { error: "해당 이메일로 가입된 계정을 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 이메일이 확인되지 않은 계정이거나 탈퇴된 계정인 경우
    // 탈퇴된 계정을 완전히 삭제하여 재가입 가능하도록 함
    if (!user.email_confirmed_at && !user.confirmed_at) {
      // 계정을 완전히 삭제
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        console.error("계정 삭제 오류:", deleteError)
        return NextResponse.json(
          { error: "계정 삭제에 실패했습니다. 관리자에게 문의해주세요." },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "탈퇴된 계정을 삭제했습니다. 다시 회원가입을 시도해주세요.",
        deleted: true,
      })
    }

    // 이미 확인된 활성 계정인 경우 - 비밀번호 재설정 링크 전송
    // 클라이언트에서 이미 시도했지만, Admin API로 다시 시도
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
      },
    })

    if (resetError) {
      console.error("비밀번호 재설정 링크 생성 오류:", resetError)
      return NextResponse.json(
        { error: "비밀번호 재설정 링크 생성에 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "이미 활성화된 계정입니다. 비밀번호 재설정 링크를 생성했습니다.",
    })
  } catch (error: unknown) {
    console.error("Resend confirmation error:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    
    return NextResponse.json(
      { error: `이메일 재전송 처리 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

