# BA KOREA AI Marketing Agent — 7 Engine Pipeline + 라이프스타일 연동 + ROAS + 실시간 시장 데이터 루프

Next.js + Supabase + Vercel 기반 실제 배포용 프로젝트입니다.
Brand → Customer → Media → Strategy(MMM) → Creative → Analytics → CLV, 7개 엔진이 순차 실행됩니다.

- **Brand / Customer / Creative / Strategy(서술)**: 서버 API Route(`/api/engine`)가 Claude API를 호출합니다. API 키는 서버에만 존재하며 브라우저에 노출되지 않습니다.
- **Media / Strategy(MMM 최적화) / ROAS / Analytics / CLV**: `src/lib/engines.ts`에 결정론적 로직으로 구현되어 있습니다.
- **캠페인 히스토리**: Supabase `campaigns` 테이블에 저장/조회/삭제됩니다.
- **실시간 시장 데이터 루프**: 수집 → 정제 → 저장 → RAG 분석 → 피드백, 5단계 루프.
- **MMM 자동 재학습**: 실제 성과 피드백이 채널별 학습 보정값(`channel_calibration`)을 갱신해, 다음 캠페인부터 예산 배분에 반영됩니다.

## 최근 업데이트 — Media/Strategy 라이프스타일 연동 + ROAS + 재학습

| 항목 | 이전 | 지금 |
|---|---|---|
| Customer Engine | 이름·연령대·페인포인트만 생성 | `audience_share`(타깃 비중), `lifestyle`(활동 시간대·채널별 목적/가중치·콘텐츠 선호·여정 터치포인트)까지 구조화된 JSON으로 생성 |
| Media Engine | 브랜드 설명 기반 고정 휴리스틱(코사인 유사도) | 페르소나별 `lifestyle.primary_platforms.weight`를 `audience_share`로 가중 평균 — 타깃이 다르면 채널 점수가 실제로 갈림 |
| Strategy Engine | Vmax = 원천효과×친화도 (내부적으로만 결합) | `rawEffect`(채널 고유 Adstock 효과)·`affinity`(페르소나 친화도)·`calibration`(학습 보정)을 결과에 모두 노출 — 왜 이 배분인지 투명하게 설명 가능 |
| Creative Engine | 암묵적 "좋은 카피" 생성 | 마케팅 목표(인지도/전환/재구매)별 카피라이팅 프레임워크(AIDA·PAS·StoryBrand·Cialdini) 지정 + `framework_breakdown`으로 단계별 근거 노출 |
| ROAS | 없음 | Strategy 배분 + 업계 벤치마크(CPM/CTR/CVR) + AOV로 채널별 추정 ROAS, 즉시/LTV 기준 Blended ROAS 산출 |
| Analytics Engine | 총예산에 블렌디드 상수(CPM/CTR/CVR) 적용 — ROAS 계산과 별도로 어긋날 위험 | ROAS의 채널별 계산 결과를 그대로 합산 — 두 계산이 하나의 소스로 통합됨 |
| 피드백 루프 | 데이터 소스 신뢰도만 갱신 | 소스 신뢰도 + **채널별 MMM 보정값까지 자동 재학습** — 실제 성과가 좋았던 채널은 다음 실행부터 더 많은 예산을 받도록 Vmax가 조정됨 |

**중요한 한계**: 위 표의 "지금" 항목들은 모두 하나의 캠페인 실행 안에서 결정론적으로 계산되며, 실제 광고 플랫폼 데이터나 실제 MMM 통계 모델(R Robyn/Python LightweightMMM 자체)이 연동된 것은 아닙니다. `CHANNEL_BENCHMARKS`(업계 평균 CPM/CTR/CVR)는 하드코딩된 시작값이며, 실측 데이터가 쌓이면 교체를 권장합니다. 이번 업데이트에서 리포트 PDF 추출 기능(Puppeteer 서버 렌더링)은 반영하지 않았습니다 — 별도로 진행 가능합니다.

## 실시간 시장 데이터 루프 구조

| 단계 | 구현 위치 | 설명 |
|---|---|---|
| 1. 수집 | `/api/market/ingest` (Vercel Cron 또는 수동 실행) | SerpAPI로 Google Trends(검색량)·Google News(원문)를 추적 키워드별로 수집 |
| 2. 정제 | `src/lib/marketData.ts` | 수치 정규화, 소스별 신뢰도 가중치(`source_effectiveness`) 부여 |
| 3. 저장 | Supabase `market_signals`(시계열) / `market_documents`(pgvector 임베딩) | TimescaleDB/Pinecone 대신 Postgres + pgvector로 경량 구현 |
| 4. 분석(RAG) | `/api/market/query` | Strategy Engine이 Claude를 호출하기 전에 벡터 유사도 검색 + 최근 시그널을 컨텍스트로 주입 |
| 5. 피드백 | `/api/feedback` | 실제 캠페인 성과(CTR/CVR/ROAS)를 입력하면, 그 캠페인이 참고했던 데이터 소스의 신뢰도 **및 채널별 MMM 보정값**을 자동 갱신 |

**중요한 한계**: 이 루프는 `SERPAPI_KEY`(수집)와 `VOYAGE_API_KEY`(임베딩)가 설정되어야 실제로 동작합니다. 둘 다 없어도 나머지 7개 엔진과 앱 전체는 정상 작동하며, 이 두 기능만 자동으로 비활성화됩니다 — 즉 선택적(optional) 확장입니다.

---

## 1. 로컬에서 실행하기

```bash
npm install
cp .env.example .env.local   # 값 채우기 (2, 3단계 참고)
npm run dev
```

`http://localhost:3000` 에서 확인합니다.

---

## 2. Supabase 프로젝트 (이미 생성 완료 ✅)

Claude가 Supabase MCP 연결을 통해 아래 작업을 실제로 완료했습니다.

- 프로젝트 `ba-korea-ai-engine` 생성 (서울 리전 `ap-northeast-2`, 무료 티어)
- `supabase/schema.sql` 마이그레이션 적용 → `campaigns`, `tracked_keywords`, `market_signals`, `market_documents`, `campaign_feedback`, `source_effectiveness` 테이블 생성, RLS 활성화 확인 완료
- `match_market_documents` pgvector 유사도 검색 함수 생성 완료
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 `.env.example`에 실제 값으로 이미 채워져 있습니다.

**직접 해야 하는 것은 딱 하나**입니다 — `service_role`(또는 신형 `sb_secret_...`) 키는 보안상 API로 조회할 수 없어 대시보드에서 직접 복사해야 합니다.

1. [Supabase 대시보드 - ba-korea-ai-engine 프로젝트](https://supabase.com/dashboard/project/bukrhzcfyfepqxpqnezu/settings/api-keys) 접속
2. **Secret keys** 섹션에서 키를 복사 (눈 아이콘 클릭 후 복사)
3. `.env.local`(로컬 실행 시) 또는 Vercel 환경변수(배포 시)의 `SUPABASE_SERVICE_ROLE_KEY`에 붙여넣기

---

## 3. Anthropic API 키 발급

[console.anthropic.com](https://console.anthropic.com) 에서 API 키를 발급받아 `ANTHROPIC_API_KEY`에 채웁니다.

---

## 4. (선택) 실시간 시장 데이터 API 키 발급

이 단계를 건너뛰어도 앱의 7개 엔진은 모두 정상 동작합니다. 실시간 시장 데이터 루프까지 쓰려면:

1. [serpapi.com](https://serpapi.com) 가입 → API 키 발급 → `SERPAPI_KEY`
2. [voyageai.com](https://www.voyageai.com) 가입 → API 키 발급 → `VOYAGE_API_KEY`

---

## 5. GitHub에 올리기

이 프로젝트 폴더에서:

```bash
git init
git add .
git commit -m "BA KOREA AI Marketing Agent - initial commit"
git branch -M main
git remote add origin https://github.com/<본인 계정>/ba-korea-ai-engine.git
git push -u origin main
```

(GitHub에서 먼저 빈 저장소 `ba-korea-ai-engine`을 생성해 두세요.)

---

## 6. Vercel에 배포하기

1. [vercel.com](https://vercel.com) 에서 New Project → 방금 올린 GitHub 저장소 Import.
2. **Environment Variables**에 아래를 등록합니다 (Production/Preview/Development 모두 체크 권장):
   - `ANTHROPIC_API_KEY` (필수)
   - `NEXT_PUBLIC_SUPABASE_URL` (필수)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (필수)
   - `SUPABASE_SERVICE_ROLE_KEY` (필수)
   - `SERPAPI_KEY` (선택 - 실시간 수집용)
   - `VOYAGE_API_KEY` (선택 - RAG 임베딩용)
3. Deploy 클릭. 빌드가 끝나면 발급되는 `*.vercel.app` 주소로 바로 접속 가능합니다.
4. 이후 `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포합니다.
5. `vercel.json`에 설정된 Cron(`/api/market/ingest`, 매일 03:00 UTC)이 자동 등록됩니다. **Vercel Hobby(무료) 플랜은 Cron이 하루 1회로 제한**되므로, 더 자주 수집하려면 Pro 플랜이 필요합니다. 무료 플랜에서는 앱 화면의 "지금 수집 실행" 버튼으로 수동 수집하시면 됩니다.

---

## 폴더 구조

```
src/
  app/
    page.tsx              # 메인 대시보드 UI (클라이언트 컴포넌트)
    layout.tsx             # 루트 레이아웃
    globals.css             # 디자인 토큰 및 전체 스타일
    api/
      engine/route.ts      # Claude API 프록시 (서버 전용, API 키 보호)
      campaigns/route.ts    # 캠페인 히스토리 CRUD (Supabase)
      market/
        keywords/route.ts   # 추적 키워드 관리 (1단계 대상 설정)
        ingest/route.ts     # 실시간 수집 (1~3단계: SerpAPI → 정제 → 저장)
        query/route.ts      # RAG 검색 (4단계: pgvector 유사도 + 최근 시그널)
      feedback/route.ts     # 성과 피드백 → 소스 신뢰도 + 채널 학습 보정값 자동 갱신 (5단계)
      market/calibration/route.ts # 채널별 MMM 학습 보정값 조회
  lib/
    engines.ts              # Media(페르소나 친화도)/Strategy(MMM)/ROAS/Analytics/CLV 계산 로직
    marketData.ts           # 임베딩(Voyage) · SerpAPI 수집 헬퍼
    supabaseAdmin.ts        # Supabase 서버 클라이언트 (service role)
supabase/
  schema.sql                # DB 스키마 (SQL Editor에서 1회 실행 - 이미 실제 프로젝트에 적용 완료)
vercel.json                  # Cron 설정 (일 1회 자동 수집)
```

---

## 현재 버전의 알려진 한계 (다음 고도화 대상)

- **Brand Engine**: 사용자가 텍스트로 브랜드를 설명해야 합니다. 실제 URL 크롤링(Firecrawl)은 연동되어 있지 않습니다.
- **Creative Engine**: 카피/숏폼 컨셉 텍스트까지만 생성합니다. 실제 이미지·영상 생성(ComfyUI + Wan2.1)은 별도 백엔드가 필요합니다.
- **Media/Strategy(MMM)/Analytics/CLV 엔진**: 실제 캠페인 이력 데이터 없이 합리적 가정값으로 즉시 계산되는 결정론적 로직입니다. 실제 Robyn/LightweightMMM 통계 모델, Geo-Lift 실험 보정은 적용되어 있지 않습니다.
- **실시간 시장 데이터 루프**: SerpAPI/Voyage 무료·저가 티어 기준으로 설계되어 있어 대량 키워드·고빈도 수집에는 요금제 조정이 필요합니다. `market_documents`의 pgvector 인덱스(ivfflat)는 데이터가 적을 때는 비효율적이므로, 문서가 충분히 쌓인 후(수백 건 이상) `REINDEX`를 권장합니다. 소스 신뢰도 갱신은 캠페인 단위로 참고 소스 전체에 동일 가중치를 적용하는 단순화된 방식입니다 (실제로는 문서별 기여도를 분리 추적하는 것이 더 정교합니다).
- 인증(로그인)과 워크스페이스별 데이터 분리는 아직 없습니다. 현재는 단일 팀 내부 도구로 설계되어 있습니다.

