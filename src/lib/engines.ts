// BA KOREA AI Marketing Agent - 결정론적(비-LLM) 엔진 로직
// Media / Strategy(MMM) / ROAS / Analytics / CLV 엔진은 여기서 계산되고,
// Brand / Customer / Creative 엔진은 /api/engine 라우트를 통해 Claude가 생성한다.

export type Brand = { tone: string; usp: string; target_summary: string; keywords: string[] };

export type PersonaLifestyle = {
  active_hours: string[]; // "morning_commute" | "lunch" | "after_work" | "weekend" | "late_night"
  primary_platforms: { channel: string; purpose: string; weight: number }[]; // weight: 0~1
  content_format_pref: string[]; // "short_form" | "long_form" | "text" | "live"
  journey_touchpoints: { stage: string; channel: string }[]; // stage: "awareness" | "consideration" | "decision"
};

export type Persona = {
  name: string;
  age_group: string;
  pain_point: string;
  decision_factor: string;
  audience_share: number; // 전체 타깃 중 비중, 모든 페르소나 합 = 1.0
  lifestyle: PersonaLifestyle;
};

export type MediaScore = { name: string; score: number };

export type StrategyChannel = {
  name: string;
  spend: number;
  percent: number;
  response: number; // 실현 효과지수 (최적화 이후, 0~100)
  rawEffect: number; // MMM 고유 효과 상한 (Adstock 반영, 타깃 무관)
  affinity: number; // Customer Engine 페르소나 기반 채널 친화도 (0~1)
  decay: number;
  calibration: number; // 실제 성과 피드백으로 학습된 보정 배수 (기본 1.0)
  reason: string;
};
export type Strategy = { channels: StrategyChannel[]; summary: string; ragSources?: string[] };

export type ROASResult = {
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
};
export type BlendedROAS = { immediateROAS: number; ltvROAS: number; totalConversions: number; totalRevenue: number };

export type Analytics = { impressions: number; clicks: number; conversions: number; trigger: string };
export type ChannelCalibration = Record<string, number>;
export type CLVResult = {
  mt: number; cac: number; ltv: number; clv: number; ratio: number | null;
  periods: { t: number; Rt: number; value: number }[]; healthy: boolean;
};

// Meta Robyn / Google LightweightMMM(Meridian) 방법론 축소 구현 - 채널별 Adstock 이월 감쇄율(λ)
export const ADSTOCK_DECAY: Record<string, number> = {
  "메타 (Meta)": 0.35,
  "네이버 검색광고": 0.15,
  "틱톡 / 숏폼": 0.45,
  "유튜브": 0.4,
  "카카오모먼트": 0.25,
};
export const CHANNELS = Object.keys(ADSTOCK_DECAY);

// 업계 평균 CPM/CTR/CVR 벤치마크 (하드코딩 시작값 - 실측 데이터가 쌓이면 교체 권장)
export const CHANNEL_BENCHMARKS: Record<string, { cpm: number; ctr: number; cvr: number }> = {
  "메타 (Meta)": { cpm: 8000, ctr: 0.015, cvr: 0.025 },
  "네이버 검색광고": { cpm: 15000, ctr: 0.035, cvr: 0.045 }, // 검색은 구매의도 높아 CVR 최고
  "카카오모먼트": { cpm: 7000, ctr: 0.012, cvr: 0.03 },
  "유튜브": { cpm: 6000, ctr: 0.01, cvr: 0.015 },
  "틱톡 / 숏폼": { cpm: 5000, ctr: 0.018, cvr: 0.01 }, // 도달은 넓지만 CVR 낮음
};

// 마케팅 목표 → 카피라이팅 프레임워크 매핑 (Creative Engine에서 사용)
export const FRAMEWORK_BY_GOAL: Record<string, { name: string; steps: string[]; description: string }[]> = {
  인지도: [
    { name: "AIDA", steps: ["Attention", "Interest", "Desire", "Action"], description: "주목→관심→욕구→행동 4단계. 인지도 캠페인에 적합." },
    { name: "StoryBrand", steps: ["Character", "Problem", "Guide", "Plan", "Success"], description: "고객을 주인공으로, 브랜드를 조력자로 놓는 서사 구조." },
  ],
  전환: [
    { name: "PAS", steps: ["Problem", "Agitate", "Solve"], description: "문제 제시→문제 증폭→해결책 제시. 전환 중심 카피에 강함." },
    { name: "Cialdini_Scarcity", steps: ["Highlight_Limitation", "Create_Urgency", "Call_To_Action"], description: "한정성·긴급성으로 즉각 행동 유도." },
  ],
  재구매: [
    { name: "StoryBrand", steps: ["Character", "Problem", "Guide", "Plan", "Success"], description: "이미 겪은 긍정 경험을 상기시키는 서사 구조." },
    { name: "Cialdini_Reciprocity", steps: ["Give_Value_First", "Acknowledge_Relationship", "Invite_Return"], description: "먼저 가치를 주고 관계를 상기시켜 재구매를 유도." },
  ],
};

export function extractJSON<T = any>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON 파싱 실패");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// --- Media Engine: Customer Engine의 페르소나 lifestyle을 audience_share로 가중 평균 ---
export function runMediaEngine(personas: Persona[]): MediaScore[] {
  return CHANNELS.map((channel) => {
    let weightedSum = 0;
    let totalShare = 0;
    for (const persona of personas) {
      const share = typeof persona.audience_share === "number" ? persona.audience_share : 1 / personas.length;
      const platform = persona.lifestyle?.primary_platforms?.find((p) => p.channel === channel);
      const channelWeight = platform ? platform.weight : 0.1; // 언급 안 된 채널은 낮은 기본값
      weightedSum += channelWeight * share;
      totalShare += share;
    }
    const rawScore = totalShare > 0 ? weightedSum / totalShare : 0.1;
    return { name: channel, score: Math.round(rawScore * 100) };
  }).sort((a, b) => b.score - a.score);
}

// --- Strategy Engine (MMM): rawEffect(Adstock·Saturation 고유값) × affinity(페르소나 친화도) × calibration(학습 보정) ---
function buildSaturationParams(mediaScores: MediaScore[], budget: number, calibration: ChannelCalibration = {}) {
  return mediaScores.map(({ name, score }) => {
    const affinity = score / 100;
    const decay = ADSTOCK_DECAY[name] ?? 0.25;
    const rawEffect = 100 * (1 + decay * 0.5); // 채널 고유 상한 (타깃과 무관, Adstock 이월가치만 반영)
    const cal = calibration[name] ?? 1;
    const vmax = rawEffect * affinity * cal;
    const k = budget * (0.06 + 0.18 * affinity);
    return { name, decay, rawEffect, affinity, calibration: cal, vmax, k };
  });
}

function marginalReturn(vmax: number, k: number, x: number) {
  return (vmax * k) / Math.pow(k + x, 2);
}

function optimizeBudget(
  params: { name: string; decay: number; rawEffect: number; affinity: number; calibration: number; vmax: number; k: number }[],
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
      rawEffect: Math.round(p.rawEffect * 10) / 10,
      affinity: Math.round(p.affinity * 100) / 100,
      decay: p.decay,
      calibration: Math.round(p.calibration * 100) / 100,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// 호출 측(page.tsx)이 LLM 서술(reason)을 붙여 최종 Strategy로 합친다.
export function computeMMMAllocation(mediaScores: MediaScore[], budget: number, calibration: ChannelCalibration = {}) {
  const params = buildSaturationParams(mediaScores, budget, calibration);
  return optimizeBudget(params, budget);
}

// --- ROAS: Strategy Engine의 배분 결과 + 업계 벤치마크 + AOV로 채널별 추정 성과 산출 ---
export function computeChannelROAS(channels: StrategyChannel[], aov: number): ROASResult[] {
  const avgPercent = channels.length > 0 ? 100 / channels.length : 0;
  return channels.map((c) => {
    const bm = CHANNEL_BENCHMARKS[c.name] ?? { cpm: 8000, ctr: 0.015, cvr: 0.025 };
    // Saturation 보정: 배분비율이 평균보다 낮으면 CVR도 비례해 낮춘다 (한계 효율 반영)
    const saturationFactor = avgPercent > 0 ? Math.min(1.2, Math.max(0.6, c.percent / avgPercent)) : 1;
    const impressions = (c.spend / bm.cpm) * 1000;
    const clicks = impressions * bm.ctr;
    const conversions = clicks * bm.cvr * saturationFactor;
    const revenue = conversions * aov;
    return {
      channel: c.name,
      spend: c.spend,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      revenue: Math.round(revenue),
      roas: c.spend > 0 ? Number((revenue / c.spend).toFixed(2)) : 0,
    };
  });
}

export function computeBlendedROAS(channelResults: ROASResult[], totalBudget: number, clvPerCustomer: number): BlendedROAS {
  const totalConversions = channelResults.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = channelResults.reduce((s, c) => s + c.revenue, 0);
  const totalLtvRevenue = totalConversions * clvPerCustomer;
  return {
    immediateROAS: totalBudget > 0 ? Number((totalRevenue / totalBudget).toFixed(2)) : 0,
    ltvROAS: totalBudget > 0 ? Number((totalLtvRevenue / totalBudget).toFixed(2)) : 0,
    totalConversions,
    totalRevenue,
  };
}

// --- Analytics Engine: ROAS 채널별 계산을 그대로 합산 (블렌디드 상수 방식과 별도로 어긋나지 않도록 단일 소스로 통합) ---
export function runAnalyticsEngine(channelResults: ROASResult[], goal: string): Analytics {
  const impressions = channelResults.reduce((s, c) => s + c.impressions, 0);
  const clicks = channelResults.reduce((s, c) => s + c.clicks, 0);
  const conversions = channelResults.reduce((s, c) => s + c.conversions, 0);
  const topChannel = [...channelResults].sort((a, b) => b.conversions - a.conversions)[0]?.channel || "";
  const triggerMap: Record<string, string> = {
    전환: `가격 페이지 3회 이상 조회한 고객 → 할인 쿠폰 팝업 자동 노출 (전환 기여 1위 채널: ${topChannel})`,
    인지도: `숏폼 영상 70% 이상 시청한 유저 → 브랜드 스토리 페이지로 리타겟팅 (노출 기여 1위 채널: ${topChannel})`,
    재구매: `최근 30일 미접속 기존 고객 → 리텐션 리마인드 메시지 발송 (재구매 유력 채널: ${topChannel})`,
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
