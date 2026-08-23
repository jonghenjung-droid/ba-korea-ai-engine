-- BA KOREA AI Marketing Agent - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
-- (참고: ba-korea-ai-engine 실제 프로젝트에는 이미 적용되어 있습니다)

create extension if not exists pgcrypto;
create extension if not exists vector;

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

-- 실시간 시장 데이터 루프 -----------------------------------------------

-- 1단계: 추적 키워드
create table if not exists tracked_keywords (
  keyword text primary key,
  added_at timestamptz not null default now()
);

-- 3단계: 시계열 시장 시그널 (검색량/언급량 등 수치형 트렌드)
create table if not exists market_signals (
  id uuid primary key default gen_random_uuid(),
  collected_at timestamptz not null default now(),
  source text not null,
  keyword text not null,
  metric text not null,
  value numeric not null,
  reliability_weight numeric not null default 1.0,
  raw jsonb
);
create index if not exists market_signals_keyword_time_idx on market_signals (keyword, collected_at desc);

-- 3단계: 원문 텍스트 + 임베딩 (RAG 검색용, pgvector)
create table if not exists market_documents (
  id uuid primary key default gen_random_uuid(),
  collected_at timestamptz not null default now(),
  source text not null,
  keyword text,
  title text,
  content text not null,
  embedding vector(512),
  reliability_weight numeric not null default 1.0
);
create index if not exists market_documents_embedding_idx on market_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 4단계: RAG 유사도 검색 함수
create or replace function match_market_documents(query_embedding vector(512), match_count int default 5)
returns table(id uuid, keyword text, title text, content text, source text, reliability_weight numeric, similarity float)
language sql stable
as $$
  select id, keyword, title, content, source, reliability_weight,
         1 - (embedding <=> query_embedding) as similarity
  from market_documents
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5단계: 캠페인 실행 결과 피드백
create table if not exists campaign_feedback (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  channel text,
  actual_ctr numeric,
  actual_cvr numeric,
  actual_roas numeric,
  notes text
);

-- 5단계: 소스별 효과성 점수 (피드백 루프로 자동 갱신)
create table if not exists source_effectiveness (
  source text primary key,
  score numeric not null default 0.5,
  updated_at timestamptz not null default now(),
  sample_size integer not null default 0
);

-- 5단계: 채널별 MMM 학습 보정값 (실제 성과 피드백으로 Vmax를 자동 재학습)
create table if not exists channel_calibration (
  channel text primary key,
  multiplier numeric not null default 1.0,
  sample_size integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security 활성화.
-- 이 앱은 브라우저가 Supabase에 직접 접근하지 않고, 반드시 Next.js API Route(서버)를 거칩니다.
-- API Route는 SUPABASE_SERVICE_ROLE_KEY를 사용하며, 이 키는 RLS를 우회합니다.
-- 아래에는 anon/authenticated 대상 정책을 의도적으로 추가하지 않았습니다.
-- 즉, 브라우저에서 anon key로 직접 이 테이블에 접근하는 요청은 전부 차단됩니다.
alter table campaigns enable row level security;
alter table tracked_keywords enable row level security;
alter table market_signals enable row level security;
alter table market_documents enable row level security;
alter table campaign_feedback enable row level security;
alter table source_effectiveness enable row level security;
alter table channel_calibration enable row level security;

