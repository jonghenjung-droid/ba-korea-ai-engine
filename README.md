# BA KOREA AI Marketing Agent — 7 Engine Pipeline

Next.js + Supabase + Vercel 기반 실제 배포용 프로젝트입니다.
Brand → Customer → Media → Strategy(MMM) → Creative → Analytics → CLV, 7개 엔진이 순차 실행됩니다.

- **Brand / Customer / Creative / Strategy(서술)**: 서버 API Route(`/api/engine`)가 Claude API를 호출합니다. API 키는 서버에만 존재하며 브라우저에 노출되지 않습니다.
- **Media / Strategy(MMM 최적화) / Analytics / CLV**: `src/lib/engines.ts`에 결정론적 로직으로 구현되어 있습니다 (Adstock·Saturation 기반 예산 최적화, 글로벌 컨설팅사 CLV 공식 등).
- **캠페인 히스토리**: Supabase `campaigns` 테이블에 저장/조회/삭제됩니다.

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
- `supabase/schema.sql` 마이그레이션 적용 → `campaigns` 테이블 생성, RLS 활성화 확인 완료
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 `.env.example`에 실제 값으로 이미 채워져 있습니다.

**직접 해야 하는 것은 딱 하나**입니다 — `service_role` 키는 보안상 API로 조회할 수 없어 대시보드에서 직접 복사해야 합니다.

1. [Supabase 대시보드 - ba-korea-ai-engine 프로젝트](https://supabase.com/dashboard/project/bukrhzcfyfepqxpqnezu/settings/api) 접속
2. **Project API keys** 섹션에서 `service_role` 키를 복사
3. `.env.local`(로컬 실행 시) 또는 Vercel 환경변수(배포 시)의 `SUPABASE_SERVICE_ROLE_KEY`에 붙여넣기

---

## 3. Anthropic API 키 발급

[console.anthropic.com](https://console.anthropic.com) 에서 API 키를 발급받아 `ANTHROPIC_API_KEY`에 채웁니다.

---

## 4. GitHub에 올리기

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

## 5. Vercel에 배포하기

1. [vercel.com](https://vercel.com) 에서 New Project → 방금 올린 GitHub 저장소 Import.
2. **Environment Variables**에 아래 4개를 등록합니다 (Production/Preview/Development 모두 체크 권장):
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy 클릭. 빌드가 끝나면 발급되는 `*.vercel.app` 주소로 바로 접속 가능합니다.
4. 이후 `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포합니다.

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
  lib/
    engines.ts              # Media/Strategy(MMM)/Analytics/CLV 계산 로직
    supabaseAdmin.ts        # Supabase 서버 클라이언트 (service role)
supabase/
  schema.sql                # DB 스키마 (SQL Editor에서 1회 실행)
```

---

## 현재 버전의 알려진 한계 (다음 고도화 대상)

- **Brand Engine**: 사용자가 텍스트로 브랜드를 설명해야 합니다. 실제 URL 크롤링(Firecrawl)은 연동되어 있지 않습니다.
- **Creative Engine**: 카피/숏폼 컨셉 텍스트까지만 생성합니다. 실제 이미지·영상 생성(ComfyUI + Wan2.1)은 별도 백엔드가 필요합니다.
- **Media/Strategy/Analytics/CLV 엔진**: 실제 캠페인 이력 데이터 없이 합리적 가정값으로 즉시 계산되는 결정론적 로직입니다. Meta Robyn/Google LightweightMMM 같은 실제 통계 모델, Geo-Lift 실험 보정은 적용되어 있지 않습니다.
- 인증(로그인)과 워크스페이스별 데이터 분리는 아직 없습니다. 현재는 단일 팀 내부 도구로 설계되어 있습니다.
