-- BA KOREA AI Marketing Agent - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.

create extension if not exists pgcrypto;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  goal text not null,
  budget numeric not null,
  results jsonb not null
);

create index if not exists campaigns_created_at_idx on campaigns (created_at desc);

-- Row Level Security 활성화.
-- 이 앱은 브라우저가 Supabase에 직접 접근하지 않고, 반드시 Next.js API Route(서버)를 거칩니다.
-- API Route는 SUPABASE_SERVICE_ROLE_KEY를 사용하며, 이 키는 RLS를 우회합니다.
-- 아래에는 anon/authenticated 대상 정책을 의도적으로 추가하지 않았습니다.
-- 즉, 브라우저에서 anon key로 직접 이 테이블에 접근하는 요청은 전부 차단됩니다.
alter table campaigns enable row level security;
