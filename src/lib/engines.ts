// BA KOREA AI Marketing Agent - 결정론적(비-LLM) 엔진 로직
// Media / Strategy(MMM) / Analytics / CLV 엔진은 여기서 계산되고,
// Brand / Customer / Creative 엔진은 /api/engine 라우트를 통해 Claude가 생성한다.

export type Brand = { tone: string; usp: string; target_summary: string; keywords: string[] };
export type Persona = { name: string; age_group: string; pain_point: string; decision_factor: string };
export type MediaScore = { name: string; score: number };
export type StrategyChannel = { name: string; spend: number; percent: number; response: number; decay: number; reason: string };
export type Strategy = { channels: StrategyChannel[]; summary: string; ragSources?: string[] };
export type Analytics = { impressions: number; clicks: number; conversions: number; trigger: string };
export type CLVResult = {
  mt: number; cac: number; ltv: number; clv: number; ratio: number | null;
  periods: { t: number; Rt: number; value: number }[]; healthy: boolean;
};

export const DIMENSIONS = ["awareness", "conversion", "video", "search", "community", "premium", "young", "professional"] as const;

export const MEDIA_DB: Record<string, number[]> = {
  "메타 (Meta)": [0.8, 0.6, 0.7, 0.2, 0.5, 0.4, 0.7, 0.3],
  "네이버 검색광고": [0.3, 0.8, 0.1, 0.9, 0.2, 0.3, 0.3, 0.7],
  "틱톡 / 숏폼": [0.9, 0.3, 0.9, 0.1, 0.6, 0.2, 0.9, 0.1],
  "유튜브": [0.7, 0.5, 0.9, 0.3, 0.4, 0.5, 0.5, 0.4],
  "카카오모먼트": [0.5, 0.6, 0.4, 0.3, 0.7, 0.3, 0.4, 0.5],
};

// Meta Robyn / Google LightweightMMM(Meridian) 방법론 축소 구현
export const ADSTOCK_DECAY: Record<string, number> = {
  "메타 (Meta)": 0.35,
  "네이버 검색광고": 0.15,
  "틱톡 / 숏폼": 0.45,
  "유튜브": 0.4,
  "카카오모먼트": 0.25,
};

export function extractJSON<T = any>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON 파싱 실패");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function buildBrandVector(brand: Brand, personas: Persona[], goal: string, budget: number) {
  const v: Record<string, number> = {
    awareness: 0.5, conversion: 0.5, video: 0.5, search: 0.5,
    community: 0.4, premium: 0.4, young: 0.4, professional: 0.4,
  };
  if (goal === "인지도") { v.awareness = 0.9; v.conversion = 0.3; v.video = 0.8; }
  if (goal === "전환") { v.conversion = 0.9; v.awareness = 0.4; v.search = 0.8; }
  if (goal === "재구매") { v.community = 0.8; v.conversion = 0.6; v.professional = 0.6; }
  const youngPersona = personas.some((p) => /20|30/.test(p.age_group || ""));
  v.young = youngPersona ? 0.8 : 0.3;
  v.professional = youngPersona ? 0.3 : 0.7;
  v.premium = budget >= 20000000 ? 0.8 : budget >= 5000000 ? 0.5 : 0.3;
  const kw = (brand.keywords || []).join(" ");
  if (/영상|숏폼|비주얼|체험/.test(kw)) v.video = Math.min(1, v.video + 0.2);
  if (/검색|후기|신뢰|정보/.test(kw)) v.search = Math.min(1, v.search + 0.2);
  return DIMENSIONS.map((d) => v[d]);
}

export function runMediaEngine(brand: Brand, personas: Persona[], goal: string, budget: number): MediaScore[] {
  const bv = buildBrandVector(brand, personas, goal, budget);
  return Object.entries(MEDIA_DB)
    .map(([name, vec]) => ({ name, score: Math.round(cosine(bv, vec) * 100) }))
    .sort((a, b) => b.score - a.score);
}

function buildSaturationParams(mediaScores: MediaScore[], budget: number) {
  return mediaScores.map(({ name, score }) => {
    const scoreNorm = score / 100;
    const decay = ADSTOCK_DECAY[name] ?? 0.25;
    const vmax = 100 * scoreNorm * (1 + decay * 0.5);
    const k = budget * (0.06 + 0.18 * scoreNorm);
    return { name, score, decay, vmax, k };
  });
}

function marginalReturn(vmax: number, k: number, x: number) {
  return (vmax * k) / Math.pow(k + x, 2);
}

function optimizeBudget(
  params: { name: string; decay: number; vmax: number; k: number }[],
  totalBudget: number
) {
  const steps = 200;
  const stepSize = totalBudget / steps;
  const alloc = params.map(() => 0);
  for (let s = 0; s < steps; s++) {
    let bestIdx = 0, bestMR = -Infinity;
    params.forEach((p, idx) => {
      const mr = marginalReturn(p.vmax, p.k, alloc[idx]);
      if (mr > bestMR) { bestMR = mr; bestIdx = idx; }
    });
    alloc[bestIdx] += stepSize;
  }
  return params
    .map((p, idx) => ({
      name: p.name,
      spend: Math.round(alloc[idx]),
      percent: Math.round((alloc[idx] / totalBudget) * 1000) / 10,
      response: Math.round(((p.vmax * alloc[idx]) / (p.k + alloc[idx])) * 10) / 10,
      decay: p.decay,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// Strategy Engine: MMM 최적화(숫자) + LLM 서술(reason)을 합쳐 반환하는 것은
// 호출 측(page.tsx)의 책임이다. 여기서는 숫자 계산만 담당한다.
export function computeMMMAllocation(mediaScores: MediaScore[], budget: number) {
  const params = buildSaturationParams(mediaScores, budget);
  return optimizeBudget(params, budget);
}

export function runAnalyticsEngine(media: MediaScore[], goal: string, budget: number): Analytics {
  const avgScore = media.reduce((s, m) => s + m.score, 0) / media.length;
  const efficiency = 0.6 + (avgScore / 100) * 0.6;
  const cpm = 8000;
  const impressions = Math.round((budget / cpm) * 1000 * efficiency);
  const ctrBase = goal === "전환" ? 0.022 : goal === "재구매" ? 0.018 : 0.014;
  const clicks = Math.round(impressions * ctrBase);
  const cvrBase = goal === "전환" ? 0.05 : goal === "재구매" ? 0.06 : 0.03;
  const conversions = Math.round(clicks * cvrBase);
  const triggerMap: Record<string, string> = {
    전환: "가격 페이지 3회 이상 조회한 고객 → 할인 쿠폰 팝업 자동 노출",
    인지도: "숏폼 영상 70% 이상 시청한 유저 → 브랜드 스토리 페이지로 리타겟팅",
    재구매: "최근 30일 미접속 기존 고객 → 리텐션 리마인드 메시지 발송",
  };
  return { impressions, clicks, conversions, trigger: triggerMap[goal] || triggerMap["인지도"] };
}

// 글로벌 컨설팅사(Bain/McKinsey/Gartner/BCG) 통합 CLV 공식
// CLV = Σ [ (Mt × Rt) - C_retention,t ] / (1+d)^t - CAC
export function runCLVEngine(
  budget: number,
  analytics: Analytics,
  p: { aov: number; freq: number; marginPct: number; churnPct: number; retentionCost: number; discountPct: number; years: number }
): CLVResult {
  const margin = p.marginPct / 100;
  const churn = p.churnPct / 100;
  const d = p.discountPct / 100;
  const Mt = p.aov * p.freq * margin;
  const cac = analytics.conversions > 0 ? Math.round(budget / analytics.conversions) : 0;

  const periods: { t: number; Rt: number; value: number }[] = [];
  let ltv = 0;
  for (let t = 0; t <= p.years; t++) {
    const Rt = Math.pow(1 - churn, t);
    const value = (Mt * Rt - p.retentionCost) / Math.pow(1 + d, t);
    ltv += value;
    periods.push({ t, Rt, value });
  }
  const clv = Math.round(ltv - cac);
  const ratio = cac > 0 ? +(ltv / cac).toFixed(2) : null;

  return { mt: Math.round(Mt), cac, ltv: Math.round(ltv), clv, ratio, periods, healthy: ratio !== null && ratio >= 3 };
}
