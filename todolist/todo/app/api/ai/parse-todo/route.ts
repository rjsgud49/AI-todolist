import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { addDays, parse, format, isPast, startOfDay } from "date-fns"
import { ko } from "date-fns/locale"

// 입력 검증 상수
const MIN_LENGTH = 2
const MAX_LENGTH = 500

// 입력 전처리 함수
function preprocessInput(input: string): string {
  // 앞뒤 공백 제거
  let processed = input.trim()
  
  // 연속된 공백을 하나로 통합
  processed = processed.replace(/\s+/g, " ")
  
  // 대소문자 정규화 (한글은 영향 없음, 영문만 처리)
  // 한글 입력이므로 대소문자 정규화는 선택적
  
  return processed
}

// 입력 검증 함수
function validateInput(input: string): { valid: boolean; error?: string } {
  // 빈 문자열 체크
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "입력값이 비어있습니다. 할 일을 입력해주세요." }
  }

  // 최소 길이 체크
  if (input.length < MIN_LENGTH) {
    return { valid: false, error: `입력값이 너무 짧습니다. 최소 ${MIN_LENGTH}자 이상 입력해주세요.` }
  }

  // 최대 길이 체크
  if (input.length > MAX_LENGTH) {
    return { valid: false, error: `입력값이 너무 깁니다. 최대 ${MAX_LENGTH}자까지 입력 가능합니다.` }
  }

  // 특수 문자나 이모지 체크 (경고만, 차단하지 않음)
  // 이모지와 특수 문자는 허용하되, 과도한 사용은 경고
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]/gu
  const emojiCount = (input.match(emojiPattern) || []).length
  if (emojiCount > 5) {
    // 이모지가 너무 많으면 경고하지만 차단하지는 않음
    console.warn(`입력에 이모지가 ${emojiCount}개 포함되어 있습니다.`)
  }

  return { valid: true }
}

// 응답 스키마 정의
const parsedTodoSchema = z.object({
  title: z.string().max(80, "제목은 80자 이하여야 합니다."),
  description: z.string().max(500, "설명은 500자 이하여야 합니다.").optional().nullable(),
  due_date: z.string().nullable().describe("YYYY-MM-DD 형식의 날짜 (날짜가 없으면 null)"),
  due_time: z.string().describe("HH:mm 형식의 시간 (기본값: 09:00)"),
  priority: z.enum(["high", "medium", "low"]).describe("우선순위"),
  category: z.string().max(30, "카테고리는 30자 이하여야 합니다.").optional().nullable(),
})

export async function POST(request: Request) {
  try {
    // 요청 본문 파싱
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return Response.json(
        { error: "잘못된 요청 형식입니다. JSON 형식으로 요청해주세요." },
        { status: 400 }
      )
    }

    const { naturalLanguage } = requestBody

    // 입력 타입 검증
    if (!naturalLanguage || typeof naturalLanguage !== "string") {
      return Response.json(
        { error: "자연어 입력이 필요합니다. 'naturalLanguage' 필드에 문자열을 입력해주세요." },
        { status: 400 }
      )
    }

    // 입력 전처리
    const preprocessedInput = preprocessInput(naturalLanguage)

    // 입력 검증
    const validation = validateInput(preprocessedInput)
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // 현재 날짜/시간 정보 생성 (2025년 12월 23일로 고정)
    const now = new Date(2025, 11, 23) // 월은 0부터 시작하므로 11 = 12월
    const currentDate = format(now, "yyyy-MM-dd")
    const currentTime = format(now, "HH:mm")
    const currentDayOfWeek = format(now, "EEEE", { locale: ko })

    // Gemini API를 사용하여 자연어 파싱
    // 참고: 모델 이름이 작동하지 않으면 "gemini-2.0-flash-exp" 또는 "gemini-1.5-flash"로 변경 가능
    let result
    try {
      result = await generateObject({
        model: google("gemini-2.0-flash-exp"),
        schema: parsedTodoSchema,
        prompt: `다음 자연어 입력을 할 일 데이터로 변환해주세요. 반드시 아래 규칙을 정확히 따르고, JSON 형식으로 응답해야 합니다.

현재 날짜/시간 정보:
- 현재 날짜: ${currentDate} (${currentDayOfWeek})
- 현재 시간: ${currentTime}

자연어 입력: "${preprocessedInput}"

=== 필수 변환 규칙 ===

1. 제목(title): 할 일의 핵심 내용을 간결하게 추출 (최대 80자)

2. 설명(description): 필요시 상세 설명 추가 (선택사항, 최대 500자)

3. 날짜(due_date) 처리 규칙 - 반드시 다음 규칙을 따르세요:
   - "오늘" → 현재 날짜 (${currentDate})
   - "내일" → 현재 날짜 + 1일
   - "모레" → 현재 날짜 + 2일
   - "이번 주 [요일]" → 가장 가까운 해당 요일 (예: "이번 주 금요일" → 가장 가까운 금요일)
   - "다음 주 [요일]" → 다음주의 해당 요일 (예: "다음 주 월요일" → 다음주의 월요일)
   - "다음 주" → 현재 날짜 + 7일
   - "다음 달" → 현재 날짜 + 1개월
   - 날짜가 명시되지 않으면 null 반환
   - 반드시 YYYY-MM-DD 형식으로 반환

4. 시간(due_time) 처리 규칙 - 반드시 다음 규칙을 따르세요:
   - "아침" → 09:00
   - "점심" → 12:00
   - "오후" → 14:00
   - "저녁" → 18:00
   - "밤" → 21:00
   - "오전 [시간]시" → 해당 시간 (예: "오전 9시" → 09:00)
   - "오후 [시간]시" → 해당 시간 (예: "오후 3시" → 15:00)
   - "[시간]:[분]" 형식이면 그대로 사용 (예: "15:30" → 15:30)
   - 시간이 명시되지 않으면 기본값 "09:00" 사용
   - 반드시 HH:mm 형식으로 반환

5. 우선순위(priority) 판단 규칙 - 반드시 다음 키워드를 기준으로 판단:
   - "high": 다음 키워드 중 하나라도 포함되면 "high"
     * "급하게", "중요한", "빨리", "꼭", "반드시"
   - "medium": 다음 키워드가 포함되거나 키워드가 없으면 "medium"
     * "보통", "적당히"
     * 키워드가 전혀 없으면 기본값 "medium"
   - "low": 다음 키워드 중 하나라도 포함되면 "low"
     * "여유롭게", "천천히", "언젠가"

6. 카테고리(category) 분류 규칙 - 다음 키워드를 기준으로 분류:
   - "업무": "회의", "보고서", "프로젝트", "업무" 키워드 포함 시
   - "개인": "쇼핑", "친구", "가족", "개인" 키워드 포함 시
   - "건강": "운동", "병원", "건강", "요가" 키워드 포함 시
   - "학습": "공부", "책", "강의", "학습" 키워드 포함 시
   - 키워드가 없거나 매칭되지 않으면 null 반환
   - 최대 30자

=== 출력 형식 ===
반드시 다음 JSON 형식을 준수해야 합니다:
{
  "title": "할 일 제목",
  "description": "설명 (선택사항, 없으면 null)",
  "due_date": "YYYY-MM-DD (없으면 null)",
  "due_time": "HH:mm",
  "priority": "high" | "medium" | "low",
  "category": "카테고리 (없으면 null)"
}

=== 예시 ===
입력: "내일 오후 3시까지 중요한 팀 회의 준비하기"
출력: {
  "title": "팀 회의 준비",
  "description": null,
  "due_date": "${format(addDays(now, 1), "yyyy-MM-dd")}",
  "due_time": "15:00",
  "priority": "high",
  "category": "업무"
}

입력: "이번 주 금요일 점심에 친구 만나기"
출력: {
  "title": "친구 만나기",
  "description": null,
  "due_date": "[가장 가까운 금요일 날짜]",
  "due_time": "12:00",
  "priority": "medium",
  "category": "개인"
}

위 규칙을 정확히 따르고, 자연어 입력을 파싱하여 JSON 형식으로 반환해주세요.`,
      })
    } catch (error: unknown) {
      // API 호출 한도 초과 체크
      const errorMessage = error instanceof Error ? error.message : ""
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        return Response.json(
          { error: "API 호출 한도가 초과되었습니다. 잠시 후 다시 시도해주세요." },
          { status: 429 }
        )
      }

      // AI 처리 실패
      console.error("AI API 호출 실패:", error)
      return Response.json(
        { error: "AI 처리 중 오류가 발생했습니다. 입력을 확인하고 다시 시도해주세요." },
        { status: 400 }
      )
    }

    const parsedData = result.object

    // 후처리: 필수 필드 누락 시 기본값 설정
    if (!parsedData.title || parsedData.title.trim().length === 0) {
      parsedData.title = "할 일"
    }

    // 제목 길이 자동 조정
    let title = parsedData.title.trim()
    if (title.length > 80) {
      title = title.substring(0, 77) + "..."
    }
    if (title.length < 1) {
      title = "할 일"
    }
    parsedData.title = title

    // 우선순위 기본값
    if (!parsedData.priority) {
      parsedData.priority = "medium"
    }

    // 시간 기본값
    if (!parsedData.due_time) {
      parsedData.due_time = "09:00"
    }

    // 날짜 파싱 및 검증
    let dueDate: Date | null = null
    if (parsedData.due_date) {
      try {
        dueDate = parse(parsedData.due_date, "yyyy-MM-dd", new Date())
        // 유효한 날짜인지 확인
        if (isNaN(dueDate.getTime())) {
          dueDate = null
        } else {
          // 후처리: 생성된 날짜가 과거인지 확인
          const today = startOfDay(now)
          const parsedDay = startOfDay(dueDate)
          
          // 과거 날짜인 경우 null로 설정 (또는 경고)
          if (isPast(parsedDay) && parsedDay < today) {
            console.warn(`파싱된 날짜(${parsedData.due_date})가 과거입니다. null로 설정합니다.`)
            dueDate = null
          }
        }
      } catch (error) {
        console.error("날짜 파싱 오류:", error)
        dueDate = null
      }
    }

    // 시간 파싱 및 검증
    let dueTime = parsedData.due_time || "09:00"
    // HH:mm 형식 검증
    const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timePattern.test(dueTime)) {
      dueTime = "09:00"
    }

    // 날짜와 시간을 결합
    let finalDueDate: Date | null = null
    if (dueDate) {
      const [hours, minutes] = dueTime.split(":").map(Number)
      finalDueDate = new Date(dueDate)
      finalDueDate.setHours(hours, minutes, 0, 0)
    }

    // 응답 데이터 구성 (후처리 적용)
    const response = {
      title: title,
      description: parsedData.description?.trim() || null,
      due_date: finalDueDate ? finalDueDate.toISOString() : null,
      priority: parsedData.priority,
      category: parsedData.category?.trim() || null,
    }

    return Response.json(response)
  } catch (error: unknown) {
    console.error("API 처리 오류:", error)
    
    // 이미 처리된 오류는 재처리하지 않음
    if (error instanceof Response) {
      return error
    }
    
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    
    // 일반 서버 오류
    return Response.json(
      { error: `할 일 파싱에 실패했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

