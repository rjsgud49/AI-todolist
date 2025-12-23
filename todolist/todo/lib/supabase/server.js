import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Route Handler 전용 클라이언트 생성 함수
export function createRouteHandlerClient(request) {
  // request에서 쿠키 헤더 읽기
  const cookieHeader = request.headers.get('cookie') || ''
  
  // 쿠키 문자열을 파싱하여 배열로 변환
  const parseCookies = (cookieString) => {
    if (!cookieString) return []
    return cookieString.split(';').map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=')
      return {
        name: name.trim(),
        value: valueParts.join('=').trim(),
      }
    }).filter((cookie) => cookie.name && cookie.value)
  }

  const cookieList = parseCookies(cookieHeader)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL,
    {
      cookies: {
        getAll() {
          return cookieList
        },
        setAll(cookiesToSet) {
          // Route Handler에서는 쿠키를 설정할 수 없으므로 무시
          // 쿠키 설정은 클라이언트나 미들웨어에서 처리
        },
      },
    }
  )
}

