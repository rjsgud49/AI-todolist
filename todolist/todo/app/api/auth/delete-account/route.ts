import { createRouteHandlerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient(request)
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      )
    }

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

    const { email, password } = body as { email: string; password: string }

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    if (email !== user.email) {
      return NextResponse.json(
        { error: "이메일이 일치하지 않습니다." },
        { status: 400 }
      )
    }

    // 비밀번호 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      )
    }

    // 사용자 데이터 삭제 (todos와 users 테이블)
    // CASCADE로 인해 auth.users 삭제 시 자동 삭제되지만, 명시적으로 삭제
    const { error: todosError } = await supabase
      .from("todos")
      .delete()
      .eq("user_id", user.id)

    if (todosError) {
      console.error("Todos delete error:", todosError)
    }

    const { error: usersError } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id)

    if (usersError) {
      console.error("Users delete error:", usersError)
    }

    // 서비스 역할 키로 Admin 클라이언트 생성하여 auth.users에서 사용자 완전 삭제
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.")
      // 서비스 역할 키가 없어도 데이터는 삭제되었으므로 로그아웃 처리
      await supabase.auth.signOut()
      return NextResponse.json({
        message: "회원 탈퇴가 완료되었습니다. (서비스 역할 키가 설정되지 않아 계정은 수동으로 삭제해야 할 수 있습니다.)",
      })
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

    // Admin API로 사용자 계정 완전 삭제
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error("Admin delete user error:", deleteError)
      // 삭제 실패해도 데이터는 삭제되었으므로 로그아웃 처리
      await supabase.auth.signOut()
      return NextResponse.json({
        message: "회원 탈퇴가 완료되었습니다. (계정 삭제 중 오류가 발생했을 수 있습니다.)",
      })
    }

    // 로그아웃 처리
    await supabase.auth.signOut()

    return NextResponse.json({
      message: "회원 탈퇴가 완료되었습니다.",
    })
  } catch (error: unknown) {
    console.error("Delete account error:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    
    return NextResponse.json(
      { error: `회원 탈퇴 처리 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

