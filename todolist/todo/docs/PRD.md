# PRD — AI 기반 TODO 관리 서비스 (Next.js + Supabase + Gemini)

> 문서 목적: 프로젝트의 전반적인 방향과 기능을 구체화하고, **바로 개발에 착수 가능한 수준**의 요구사항/화면/데이터/정책을 정의한다.  
> 문서 버전: v1.0  
> 작성일: 2025-12-22 (KST)

---

## 1. 제품 개요

### 1.1 한 줄 소개
이메일/비밀번호 기반 로그인 후 개인의 할 일을 CRUD로 관리하고, 검색/필터/정렬을 제공하며, **AI가 자연어 입력을 구조화된 할 일로 변환**하고 **전체 할 일을 요약·분석**해주는 생산성 앱.

### 1.2 문제 정의
- 사용자는 할 일을 빠르게 기록하고 관리하고 싶지만, 입력 과정이 번거롭다.
- 많은 할 일 목록에서 우선순위를 파악하고 진행 상황을 한 눈에 보기 어렵다.
- 일일/주간 회고를 위해 완료/잔여/지연을 정리하는 것이 귀찮다.

### 1.3 목표(Goals)
- 인증부터 할 일 관리까지 **모바일/데스크톱에서 빠르고 안정적인 사용 경험** 제공
- 검색/필터/정렬로 목록 탐색 시간을 단축
- 자연어 입력 → 구조화 데이터 변환으로 입력 시간 단축
- AI 요약/분석으로 회고/계획 수립을 돕기

### 1.4 비목표(Non-goals, v1 범위 밖)
- 팀/공유/협업(초대, 권한, 코멘트)
- 캘린더 연동(Google Calendar 등)
- 푸시 알림/리마인더
- 첨부파일/이미지 업로드
- 오프라인 모드

---

## 2. 타겟 사용자 & 핵심 시나리오

### 2.1 타겟 사용자
- 개인 생산성/학습/업무 할 일 관리를 원하는 사용자(학생, 직장인)
- “문장 한 줄로 일정/할 일을 적어두는 습관”이 있는 사용자

### 2.2 핵심 사용자 시나리오
1) 사용자는 회원가입 후 로그인한다.  
2) 메인 화면에서 할 일을 생성하고(수동 또는 AI), 목록을 검색/필터/정렬한다.  
3) 완료 체크 및 수정/삭제를 반복하며 진행 상황을 관리한다.  
4) 버튼 클릭으로 일일/주간 요약·분석을 확인한다.

---

## 3. 성공 지표(Analytics / KPI)

> v1에서는 기본 이벤트 로깅만 고려(예: PostHog/GA 추후). Supabase logs만으로도 최소 측정.

- 가입 전환율: 방문 대비 회원가입 성공
- 활성 사용자 비율: 주간 활성 사용자(WAU)
- 할 일 생성 성공률: 생성 시도 대비 성공
- AI 생성 사용률: 전체 생성 중 AI 생성 비중
- AI 요약 사용률: 요약 버튼 클릭 비중
- 재방문: 7일 리텐션

---

## 4. 주요 기능 요구사항

### 4.1 인증(로그인/회원가입) — Supabase Auth
#### 기능 목록
- 이메일/비밀번호 회원가입
- 이메일/비밀번호 로그인
- 로그아웃
- 세션 유지(새로고침 후에도 로그인 상태 유지)
- (선택) 비밀번호 재설정(Reset Password) — v1.1 후보

#### 정책/제약
- Supabase Auth의 `auth.users`를 사용(별도 users 테이블 직접 CRUD X)
- 사용자 추가 프로필이 필요하면 `public.profiles` 테이블로 확장(권장)

#### 수용 기준(AC)
- 올바른 이메일/비번으로 가입/로그인 가능
- 잘못된 비번 시 에러 메시지 노출
- 로그인 후 보호된 라우트 접근 가능 / 비로그인 시 로그인으로 리다이렉트

---

### 4.2 할 일 관리(CRUD)
#### 데이터 필드(요구 필드)
- `title` (string, required, max 80)
- `description` (string, optional, max 500)
- `created_date` (timestamp, required, default now)
- `due_date` (timestamp, optional)
- `priority` (enum: high | medium | low, default medium)
- `category` (string, optional, 예: 업무/개인/학습, max 30)
- `completed` (boolean, default false)

#### 기능 목록
- 생성(Create)
  - 수동 입력 폼으로 생성
  - 기본값 자동 입력(우선순위=medium, completed=false)
- 조회(Read)
  - 목록 조회(페이지 진입 시 기본)
  - 상세 보기(모달 또는 별도 페이지)
- 수정(Update)
  - 필드 편집
  - 완료 체크/해제(토글)
- 삭제(Delete)
  - 단건 삭제
  - (선택) 다중 선택 삭제 — v1.1 후보

#### 진행 상태(Status) 정의
- `completed = true` → **완료**
- `completed = false` and `due_date`가 있고 `due_date < now()` → **지연**
- 그 외 → **진행 중**

> `status`는 파생 값이므로 DB 컬럼을 추가하지 않고 UI/쿼리에서 계산하는 것을 기본으로 한다.  
> 성능/복잡도가 커지면 `status`를 generated column 또는 view로 확장 가능.

#### 수용 기준(AC)
- 사용자는 본인의 todo만 조회/수정/삭제 가능(RLS로 강제)
- 생성 직후 목록에 반영(Optimistic UI 또는 revalidate)
- 수정 후 즉시 반영
- 삭제 전 확인(Confirm) UX 제공

---

### 4.3 검색/필터/정렬
#### 검색(Search)
- 대상: `title`, `description`
- 방식: 부분 일치(ILIKE) 기반
- 공백 입력 시 검색 해제

#### 필터(Filter)
- 우선순위: high / medium / low (다중 선택 가능)
- 카테고리: 업무/개인/학습 등 (다중 선택 가능, 사용자 입력 기반)
- 진행 상태: 진행 중 / 완료 / 지연 (다중 선택 가능)

#### 정렬(Sort)
- 우선순위순 (high → medium → low)
- 마감일순 (due_date ASC, nulls last)
- 생성일순 (created_date DESC 기본)

#### 수용 기준(AC)
- 검색어 + 필터 + 정렬 조합이 동시에 동작
- 조건 변경 시 목록이 즉시 갱신
- 조건은 URL querystring으로 유지(새로고침/공유 시 유지) — 권장

---

### 4.4 AI 할 일 생성(NL → Structured Todo)
#### 기능 개요
사용자의 자연어 입력을 AI가 해석해, Todo 생성 폼에 자동으로 채우거나 바로 생성한다.

- 입력 예: `"내일 오전 10시에 팀 회의 준비"`
- 출력(JSON) 예:
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성하기",
  "created_date": "YYYY-MM-DDTHH:MM:SS+09:00",
  "due_date": "YYYY-MM-DDT10:00:00+09:00",
  "priority": "high",
  "category": "업무",
  "completed": false
}
```

#### 요구사항
- AI는 **JSON 단일 객체**로 응답해야 한다(파싱 안정성).
- 날짜 해석은 **사용자 타임존(KST, Asia/Seoul)** 기준으로 수행한다.
- AI 결과를 사용자에게 **미리보기/수정** 후 저장하는 플로우를 기본으로 한다(안전성).

#### 에러/예외 처리
- 날짜/시간이 모호한 경우: due_date를 null로 두고 description에 “시간 미정” 등 보완
- JSON 파싱 실패: 사용자에게 재시도 버튼 제공 + 원문 보존
- API rate limit/실패: 일반 수동 생성 폼으로 전환 옵션 제공

#### 수용 기준(AC)
- 자연어 입력 후 2~3초 내(환경에 따라) 미리보기 결과 노출
- 사용자가 수정 후 저장 가능
- 저장 시 정상적으로 todos에 삽입

---

### 4.5 AI 요약 및 분석(전체 TODO → Summary/Insights)
#### 기능 개요
버튼 클릭 한 번으로 AI가 사용자의 전체 할 일을 분석하여 요약을 제공한다.

#### 출력 요구(구조화)
- 일일 요약(Daily)
  - 오늘 완료된 항목 요약
  - 오늘 남은(미완료) 항목 요약
  - 지연 항목(가능하면) 강조
- 주간 요약(Weekly)
  - 이번 주 완료율(%)
  - 카테고리별 분포(간단)
  - 개선 제안 1~3개(현실적)

#### 입력 데이터 범위
- 일일 요약: `오늘 00:00 ~ 23:59` 기준 created/updated 기반이 아니라, **completed 토글 시각이 없다면** “오늘 due/오늘 완료 체크된 것” 기준으로 단순화한다.
- 주간 요약: `이번 주(월~일)` 기준 due_date 또는 created_date를 활용(정책 선택)

> v1에서는 todo 테이블에 `completed_at`이 없으므로, “오늘 완료된 항목”의 정확도는 제한적이다.  
> 정확도를 위해 v1.1에서 `completed_at` 컬럼 추가를 추천(아래 12장 참고).

#### 수용 기준(AC)
- 요약 결과는 카드 형태로 화면에 표시
- 실패 시 재시도 가능
- 결과는 사용자에게만 노출(서버 로그에 민감정보 남기지 않기)

---

## 5. 화면 구성(IA) 및 상세 설계

### 5.1 전체 정보 구조(IA)
- `/auth/login` 로그인
- `/auth/signup` 회원가입
- `/app` 메인(할 일 관리)
- `/app/stats` 통계/분석(확장)
- (옵션) `/app/settings` 설정(프로필/로그아웃)

---

### 5.2 로그인 화면
#### 구성 요소
- 입력: 이메일, 비밀번호
- 버튼: 로그인, 회원가입 이동
- 메시지: 에러/성공 토스트

#### 상태
- 로딩(로그인 중)
- 실패(오류 메시지)
- 성공(메인으로 이동)

---

### 5.3 회원가입 화면
#### 구성 요소
- 입력: 이메일, 비밀번호, 비밀번호 확인(프론트 validation)
- 버튼: 회원가입, 로그인 이동

#### 정책
- 최소 비밀번호 길이(예: 8자) + 간단 규칙(영문/숫자 권장)
- 이미 존재하는 이메일이면 안내

---

### 5.4 할 일 관리 메인 화면(`/app`)
#### 레이아웃(권장)
- 상단: 앱 타이틀, 사용자 메뉴(로그아웃)
- 좌측/상단: 검색창
- 필터 영역: 우선순위, 카테고리, 상태(Chip/Dropdown)
- 정렬 Dropdown
- 본문: Todo 리스트(카드/테이블)
- 우측 하단: “+ 할 일 추가” FAB 또는 버튼
- AI 기능:
  - “AI로 할 일 생성” 입력창/모달
  - “AI 요약(일일/주간)” 버튼

#### 리스트 아이템(카드) 구성
- 제목, 우선순위 배지, 카테고리 태그
- 마감일, 상태(진행중/완료/지연)
- 체크박스(완료 토글)
- 수정(연필), 삭제(휴지통)

#### 빈 상태(Empty State)
- “할 일이 없습니다. 새 할 일을 추가해보세요.”
- 검색 결과 없음: “검색 결과가 없습니다.”

---

### 5.5 통계 및 분석 화면(`/app/stats`) — 확장
- 주간 완료율(%) 그래프
- 카테고리별 분포(도넛/바)
- 우선순위별 분포
- AI 주간 리포트(요약 텍스트)

> v1에서는 UI 뼈대만 만들고 데이터는 todos 기반 집계로 구현 가능.

---

## 6. 유저 스토리 & 수용 기준(요약)

### 6.1 인증
- US-01: 사용자는 이메일/비밀번호로 가입할 수 있다.
- US-02: 사용자는 로그인/로그아웃 할 수 있다.
- AC: 비로그인 사용자는 `/app` 접근 시 `/auth/login`으로 이동한다.

### 6.2 Todo CRUD
- US-10: 사용자는 할 일을 생성할 수 있다.
- US-11: 사용자는 목록에서 할 일을 조회할 수 있다.
- US-12: 사용자는 할 일을 수정/삭제할 수 있다.
- US-13: 사용자는 완료 여부를 토글할 수 있다.
- AC: 다른 사용자의 todo는 어떤 방식으로도 접근 불가(RLS).

### 6.3 탐색(검색/필터/정렬)
- US-20: 사용자는 제목/설명으로 검색할 수 있다.
- US-21: 사용자는 우선순위/카테고리/상태로 필터링할 수 있다.
- US-22: 사용자는 정렬 조건을 변경할 수 있다.
- AC: 조합 조건이 정확히 반영된다.

### 6.4 AI
- US-30: 사용자는 자연어로 할 일을 입력해 구조화 결과를 얻는다.
- US-31: 사용자는 AI 결과를 수정 후 저장할 수 있다.
- US-32: 사용자는 AI로 일일/주간 요약을 확인한다.
- AC: 파싱 실패 시 안전한 재시도 UX가 존재한다.

---

## 7. 기술 스택 및 아키텍처

### 7.1 기술 스택
- Frontend: **Next.js(App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**
- Backend(BFF): Next.js Route Handlers(`/app/api/*`) 또는 Server Actions
- Auth/DB: **Supabase Auth**, **Supabase Postgres**
- AI: **AI SDK + Google Gemini API**
- 배포(권장): Vercel(프론트) + Supabase(백엔드) 또는 단일 배포

### 7.2 아키텍처 개요
```mermaid
flowchart LR
  U[User Browser] -->|HTTPS| N[Next.js App]
  N -->|Auth Session/JWT| S[Supabase Auth]
  N -->|SQL via supabase-js| D[(Supabase Postgres)]
  N -->|Route Handler / Server Action| A[AI Layer (AI SDK)]
  A -->|Gemini API| G[Google Gemini]
```

### 7.3 권장 구현 원칙
- **클라이언트에서 Gemini 직접 호출 금지**(API Key 노출 위험)  
  → Next.js 서버(Route Handler)에서만 호출
- Supabase는 **RLS**로 데이터 보호
- Next.js: Client Component 최소화(폼/인터랙션만 Client)

---

## 8. API 설계(Next.js Route Handlers 기준)

> 실제 구현은 `supabase-js`를 사용하며, 클라이언트에서 DB 직접 접근도 가능하지만,  
> **AI 기능은 서버에서만 처리**가 필수.

### 8.1 Auth
- Supabase SDK 제공 기능 사용(별도 API 정의 필요 없음)

### 8.2 Todos
#### GET `/api/todos`
- Query
  - `q` 검색어
  - `priority` (comma separated) 예: `high,low`
  - `category` (comma separated)
  - `status` (comma separated) `in_progress,completed,overdue`
  - `sort` = `created_date|due_date|priority`
  - `order` = `asc|desc`
- Response: todo list

#### POST `/api/todos`
- Body: todo fields(필수 title)
- Response: created todo

#### PATCH `/api/todos/:id`
- Body: 변경 필드(부분 업데이트)
- Response: updated todo

#### DELETE `/api/todos/:id`
- Response: `{ success: true }`

> v1에서 클라이언트가 Supabase에 직접 CRUD할 경우, 위 API는 생략 가능.  
> 다만 서버 캐싱/로깅/검증이 필요하면 BFF 형태로 위 API를 권장.

---

### 8.3 AI
#### POST `/api/ai/todo`
- Body: `{ text: string }`
- Response: `{ todoDraft: TodoDraft }`
- 요구: JSON schema validation(Zod) 적용

#### POST `/api/ai/summary`
- Body: `{ mode: "daily" | "weekly" }`
- Response: `{ summary: SummaryResult }`
- 요구: 필요한 todo만 서버에서 조회해 AI에 전달(최소화)

---

## 9. 데이터 구조(DB) — Supabase(Postgres)

### 9.1 권장 테이블 구성
> Supabase Auth 기본: `auth.users` (직접 수정 X)  
> 추가 프로필: `public.profiles` (선택)

#### `public.profiles` (선택)
- `id` uuid (PK, references auth.users.id)
- `email` text (optional, view 용도)
- `created_at` timestamptz default now()

#### `public.todos` (필수)
| 컬럼 | 타입 | 제약/기본값 | 설명 |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | todo 식별자 |
| user_id | uuid | not null, FK → auth.users.id | 소유자 |
| title | text | not null, length <= 80 | 제목 |
| description | text | null, length <= 500 | 설명 |
| created_date | timestamptz | not null default now() | 생성일 |
| due_date | timestamptz | null | 마감일 |
| priority | text | not null default 'medium' | high/medium/low |
| category | text | null | 업무/개인/학습 등 |
| completed | boolean | not null default false | 완료 여부 |
| updated_at | timestamptz | not null default now() | 수정일 |

#### 인덱스(권장)
- `(user_id, created_date desc)`
- `(user_id, due_date asc)`
- `(user_id, priority)`
- full text search 고려 시 `title/description`에 `tsvector` 확장(v1.1)

### 9.2 RLS(Row Level Security) 정책 (필수)
#### `public.todos` 정책
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` (또는 `user_id`를 서버에서 강제 주입)
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

> Supabase SQL 예시(개념):
```sql
alter table public.todos enable row level security;

create policy "todos_select_own"
on public.todos for select
using (auth.uid() = user_id);

create policy "todos_insert_own"
on public.todos for insert
with check (auth.uid() = user_id);

create policy "todos_update_own"
on public.todos for update
using (auth.uid() = user_id);

create policy "todos_delete_own"
on public.todos for delete
using (auth.uid() = user_id);
```

---

## 10. AI 설계(프롬프트/스키마/검증)

### 10.1 공통 원칙
- AI 응답은 **반드시 JSON** (설명 텍스트 금지)
- 서버에서 **Zod 스키마 검증** 후 프론트로 전달
- 날짜는 ISO 8601 with timezone(`+09:00`) 권장

### 10.2 TodoDraft 스키마(예시)
```ts
type Priority = "high" | "medium" | "low";

type TodoDraft = {
  title: string;
  description?: string;
  created_date: string; // ISO
  due_date?: string | null; // ISO or null
  priority: Priority;
  category?: string | null;
  completed: boolean; // always false for create
};
```

### 10.3 AI Todo 생성 프롬프트(권장 형태)
- System: “당신은 할 일을 구조화하는 도우미이며, 출력은 JSON만…”
- User: `{ text: "...", timezone: "Asia/Seoul", now: "..." }`
- 모델이 모호한 부분은 null 처리 + description 보완

### 10.4 요약 결과 스키마(예시)
```ts
type SummaryResult = {
  title: string;           // "오늘의 요약" / "주간 요약"
  highlights: string[];    // 핵심 bullet
  completedCount: number;
  pendingCount: number;
  overdueCount: number;
  completionRate?: number; // weekly only
  suggestions: string[];   // 1~3
};
```

---

## 11. 비기능 요구사항(NFR)

### 11.1 성능
- `/app` 최초 로드 시 1초 내 주요 UI 표시(네트워크에 따라)
- 목록 업데이트는 로컬에서 즉시 반응(Optimistic UI 권장)

### 11.2 보안
- RLS로 데이터 접근 제어
- Gemini API Key는 서버 환경변수로만 관리
- 로그에 개인정보/토큰/원문 입력(민감) 최소화

### 11.3 접근성/UX
- 키보드로 폼 입력 및 버튼 접근 가능
- 오류 메시지 명확하게
- 빈 상태/로딩 상태/실패 상태 UI 제공

### 11.4 국제화(i18n)
- v1: 한국어 UI 기준
- 날짜 포맷은 locale 기반으로 표시

---

## 12. 확장/개선 제안(v1.1+)
- `completed_at` 컬럼 추가 → “오늘 완료한 항목” 정확도 상승
- 카테고리 테이블 분리(`categories`) 및 사용자별 관리
- 태그/라벨 기능
- 통계 화면 정식 구현(차트)
- Full-text search(tsvector) 적용
- 푸시 알림(마감 임박, 지연)

---

## 13. 개발 마일스톤(권장)
1) 프로젝트 세팅(Next.js + Tailwind + shadcn/ui) + Supabase 연결  
2) Auth 화면/가드 라우팅  
3) Todos CRUD + RLS 정책 적용  
4) 검색/필터/정렬 UI + 쿼리 연동  
5) AI Todo 생성 API + Draft Preview/Save  
6) AI 요약 API + UI 카드  
7) 통계 화면 스켈레톤 + 간단 집계  
8) QA(권한/에러/엣지케이스) + 배포

---

## 14. QA 체크리스트(핵심)
- [ ] 비로그인 사용자의 `/app` 접근 차단
- [ ] 다른 user_id todo 접근 불가(직접 요청 포함)
- [ ] due_date 없는 항목의 정렬/필터 정상
- [ ] overdue 계산이 타임존(KST)에서 기대대로 동작
- [ ] AI 결과 JSON 파싱 실패 시 안전한 UX
- [ ] 삭제 confirm 동작 및 undo(선택) 여부

---

## 15. 부록: UI 컴포넌트(권장)
- `AuthForm` (Login/Signup 공용)
- `TodoForm` (Create/Edit 모달)
- `TodoItemCard`
- `FilterBar` (priority/category/status)
- `SortDropdown`
- `AiTodoModal` (자연어 → Draft)
- `AiSummaryCard`

---

**끝.**
