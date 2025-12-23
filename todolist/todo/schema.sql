-- ============================================
-- Supabase TodoList 프로젝트 스키마
-- PRD 문서 기반 데이터베이스 구조
-- ============================================

-- ============================================
-- 1. public.users 테이블 생성
-- auth.users와 1:1로 연결되는 사용자 프로필 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users 테이블 updated_at 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. public.todos 테이블 생성
-- 각 사용자별 할 일 관리 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (LENGTH(title) <= 80),
  description TEXT CHECK (description IS NULL OR LENGTH(description) <= 500),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT CHECK (category IS NULL OR LENGTH(category) <= 30),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- todos 테이블 updated_at 트리거
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. 인덱스 생성
-- ============================================

-- users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- todos 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_user_id_created_date ON public.todos(user_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_todos_user_id_due_date ON public.todos(user_id, due_date ASC) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_id_priority ON public.todos(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_todos_user_id_completed ON public.todos(user_id, completed);

-- ============================================
-- 4. Row Level Security (RLS) 활성화
-- ============================================

-- users 테이블 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- todos 테이블 RLS 활성화
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. public.users 테이블 RLS 정책
-- ============================================

-- SELECT 정책: 자신의 프로필만 조회 가능
CREATE POLICY "users_select_own"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- INSERT 정책: 자신의 프로필만 생성 가능
CREATE POLICY "users_insert_own"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE 정책: 자신의 프로필만 수정 가능
CREATE POLICY "users_update_own"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- DELETE 정책: 자신의 프로필만 삭제 가능
CREATE POLICY "users_delete_own"
ON public.users FOR DELETE
USING (auth.uid() = id);

-- ============================================
-- 6. public.todos 테이블 RLS 정책
-- ============================================

-- SELECT 정책: 자신의 할 일만 조회 가능
CREATE POLICY "todos_select_own"
ON public.todos FOR SELECT
USING (auth.uid() = user_id);

-- INSERT 정책: 자신의 할 일만 생성 가능 (user_id 자동 설정)
CREATE POLICY "todos_insert_own"
ON public.todos FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE 정책: 자신의 할 일만 수정 가능
CREATE POLICY "todos_update_own"
ON public.todos FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE 정책: 자신의 할 일만 삭제 가능
CREATE POLICY "todos_delete_own"
ON public.todos FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 7. auth.users 삭제 시 자동으로 프로필 생성하는 함수
-- (선택사항: 회원가입 시 자동 프로필 생성)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거: auth.users에 새 사용자가 생성되면 public.users에도 자동 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 완료
-- ============================================

