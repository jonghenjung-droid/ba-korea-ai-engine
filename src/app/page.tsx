"use client";

import { useEffect, useState } from "react";
import {
  Layers, Users, Target, Sparkles, Radar, LineChart, Repeat,
  Play, RotateCcw, Loader2, ChevronDown, AlertCircle, Wand2, History, Trash2, Clock,
} from "lucide-react";
import {
  Brand, Persona, MediaScore, Strategy, Analytics, CLVResult,
  extractJSON, runMediaEngine, computeMMMAllocation, runAnalyticsEngine, runCLVEngine,
} from "@/lib/engines";

type Creative = { copies: { headline: string; body: string }[]; short_form_concept: string };

type Results = {
  brand: Brand | null;
  personas: Persona[] | null;
  strategy: Strategy | null;
  creative: Creative | null;
  media: MediaScore[] | null;
  analytics: Analytics | null;
  clv: CLVResult | null;
};

type CampaignRecord = {
  id: string;
  created_at: string;
  name: string;
  description: string;
  goal: string;
  budget: number;
  results: Results;
};

const ENGINES = [
  { key: "brand", label: "Brand Engine", sub: "브랜드 DNA 추출", icon: Layers },
  { key: "customer", label: "Customer Engine", sub: "타깃 페르소나 생성", icon: Users },
  { key: "media", label: "Media Engine", sub: "매체 매칭 스코어링", icon: Radar },
  { key: "strategy", label: "Strategy Engine", sub: "MMM 예산 최적화 (Adstock·Saturation)", icon: Target },
  { key: "creative", label: "Creative Engine", sub: "카피 & 크리에이티브", icon: Sparkles },
  { key: "analytics", label: "Analytics Engine", sub: "퍼널 예측 & 트리거", icon: LineChart },
  { key: "clv", label: "CLV Engine", sub: "고객생애가치(CLV) 통합 산출", icon: Repeat },
] as const;

const GOALS = [
  { code: "인지도", label: "인지도 확대" },
  { code: "전환", label: "전환 극대화" },
  { code: "재구매", label: "재구매 유도" },
];

const EXAMPLE = {
  name: "메종드글램",
  desc: "가평 소재 프리미엄 글램핑 브랜드. 지하수 70M 인피니티풀과 프라이빗 텐트동을 갖춘 감성 숙박 공간으로, 커플·가족 단위 고객에게 자연 속 힐링 경험을 제공. 네이버플레이스와 인스타그램을 중심으로 시즌별 캠페인을 운영 중이며, 재방문율이 높은 것이 특징.",
};

const EMPTY_RESULTS: Results = { brand: null, personas: null, strategy: null, creative: null, media: null, analytics: null, clv: null };

async function callClaude(system: string, prompt: string) {
  const res = await fetch("/api/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 호출 실패 (${res.status})`);
  return extractJSON(data.text);
}

export default function Home() {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState(5000000);
  const [goal, setGoal] = useState("전환");
  const [stage, setStage] = useState(-1); // -1 idle, 0..N-1 running, N done
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [showState, setShowState] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [history, setHistory] = useState<CampaignRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [aov, setAov] = useState(350000);
  const [freq, setFreq] = useState(1.4);
  const [marginPct, setMarginPct] = useState(45);
  const [churnPct, setChurnPct] = useState(35);
  const [retentionCost, setRetentionCost] = useState(15000);
  const [discountPct, setDiscountPct] = useState(10);
  const [years, setYears] = useState(3);

  const running = stage >= 0 && stage < ENGINES.length;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/campaigns");
        const data = await res.json();
        if (res.ok) setHistory(data.campaigns || []);
        else setHistoryError(data.error || "히스토리를 불러오지 못했습니다.");
      } catch (e) {
        setHistoryError("히스토리를 불러오지 못했습니다.");
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, []);

  async function saveCampaignToHistory(record: { name: string; description: string; goal: string; budget: number; results: Results }) {
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setHistory((h) => [data.campaign, ...h].slice(0, 20));
      } else {
        setHistoryError(data.error || "히스토리 저장에 실패했습니다.");
      }
    } catch (e) {
      setHistoryError("히스토리 저장 중 오류가 발생했습니다.");
    }
  }

  async function deleteFromHistory(id: string) {
    const prev = history;
    setHistory((h) => h.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/campaigns?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setHistoryError(data.error || "히스토리 삭제에 실패했습니다.");
        setHistory(prev);
      }
    } catch (e) {
      setHistoryError("히스토리 삭제 중 오류가 발생했습니다.");
      setHistory(prev);
    }
  }

  function loadFromHistory(record: CampaignRecord) {
    setName(record.name);
    setDesc(record.description || "");
    setGoal(record.goal);
    setBudget(record.budget);
    setResults(record.results);
    setError(null);
    setStage(ENGINES.length);
  }

  function fillExample() {
    setName(EXAMPLE.name);
    setDesc(EXAMPLE.desc);
  }

  function reset() {
    setStage(-1);
    setError(null);
    setResults(EMPTY_RESULTS);
  }

  async function runPipeline() {
    if (!name.trim() || !desc.trim()) {
      setError("브랜드명과 브랜드 설명을 입력해 주세요.");
      return;
    }
    setError(null);
    setResults(EMPTY_RESULTS);

    try {
      setStage(0);
      const brand: Brand = await callClaude(
        "너는 BA KOREA의 AI Brand Engine이다. 입력된 브랜드 정보를 분석해 브랜드 DNA를 JSON으로만 출력한다. 다른 설명은 절대 출력하지 마라.",
        `브랜드명: ${name}\n브랜드 설명: ${desc}\n\n다음 형식의 JSON으로만 답하라:\n{"tone": "브랜드 톤앤매너 한 문장", "usp": "핵심 차별점 한 문장", "target_summary": "핵심 타깃 요약 한 문장", "keywords": ["키워드1","키워드2","키워드3","키워드4"]}`
      );
      setResults((r) => ({ ...r, brand }));

      setStage(1);
      const customer = await callClaude(
        "너는 AI Customer Engine이다. Brand DNA를 바탕으로 핵심 타깃 페르소나 3개를 JSON으로만 생성한다.",
        `Brand DNA: ${JSON.stringify(brand)}\n\n다음 형식의 JSON으로만 답하라:\n{"personas":[{"name":"페르소나 이름(예: 3040 워킹맘 지현)","age_group":"연령대","pain_point":"핵심 페인포인트 한 문장","decision_factor":"구매 결정 요인 한 문장"}] } 총 3개 항목`
      );
      const personas: Persona[] = customer.personas || [];
      setResults((r) => ({ ...r, personas }));

      setStage(2);
      const media = runMediaEngine(brand, personas, goal, budget);
      setResults((r) => ({ ...r, media }));

      setStage(3);
      const optimized = computeMMMAllocation(media, budget);
      const narrative = await callClaude(
        "너는 AI Strategy Engine이다. MMM(Adstock·Saturation) 최적화 엔진이 이미 산출한 채널별 예산 배분 결과에 대해, 브랜드/타깃 관점의 배정 이유를 채널마다 한 문장씩 설명하고 전체 전략을 한 줄로 요약한다. 배분 비율(percent) 자체는 절대 바꾸지 말고 이유만 작성한다. JSON으로만 답하라.",
        `Brand DNA: ${JSON.stringify(brand)}\nPersonas: ${JSON.stringify(personas)}\n마케팅 목표: ${goal}\nMMM 최적화 배분 결과: ${JSON.stringify(optimized.map((o) => ({ name: o.name, percent: o.percent })))}\n\n다음 형식의 JSON으로만 답하라:\n{"channel_reasons":[{"name":"채널명","reason":"배정 이유 한 문장"}], "summary":"전체 전략 한 줄 요약"}`
      );
      const reasonMap: Record<string, string> = Object.fromEntries(
        (narrative.channel_reasons || []).map((c: any) => [c.name, c.reason])
      );
      const strategy: Strategy = {
        channels: optimized.map((o) => ({ ...o, reason: reasonMap[o.name] || "" })),
        summary: narrative.summary || "",
      };
      setResults((r) => ({ ...r, strategy }));

      setStage(4);
      const creative: Creative = await callClaude(
        "너는 AI Creative Engine이다. 브랜드 DNA와 전략을 바탕으로 광고 카피와 숏폼 컨셉을 JSON으로만 생성한다.",
        `Brand DNA: ${JSON.stringify(brand)}\n전략 요약: ${strategy.summary || ""}\n\n다음 형식의 JSON으로만 답하라:\n{"copies":[{"headline":"헤드라인","body":"서브카피 한 문장"}], "short_form_concept":"15초 숏폼 영상 컨셉 한 단락"} copies는 총 3개`
      );
      setResults((r) => ({ ...r, creative }));

      setStage(5);
      const analytics = runAnalyticsEngine(media, goal, budget);
      setResults((r) => ({ ...r, analytics }));

      setStage(6);
      const clv = runCLVEngine(budget, analytics, { aov, freq, marginPct, churnPct, retentionCost, discountPct, years });
      setResults((r) => ({ ...r, clv }));

      setStage(7);
      await saveCampaignToHistory({
        name, description: desc, goal, budget,
        results: { brand, personas, strategy, creative, media, analytics, clv },
      });
    } catch (e: any) {
      setError("AI 엔진 실행 중 오류가 발생했습니다: " + e.message);
      setStage(-1);
    }
  }

  return (
    <div className="ba-root">
      <div className="ba-wrap">
        <div className="ba-eyebrow">BA KOREA · Next.js + Supabase · PRODUCTION</div>
        <h1 className="ba-title">AI Marketing Agent<br />— 7 Engine Pipeline</h1>
        <p className="ba-sub">
          브랜드 정보를 입력하면 Brand → Customer → Media → Strategy → Creative → Analytics → CLV 순으로 에이전트가 순차 실행됩니다.
          Brand·Customer·Creative 엔진은 서버 API Route를 통해 Claude를 호출하며, Media 엔진은 자체 매칭 알고리즘, Strategy 엔진은
          Meta Robyn·Google LightweightMMM 방법론(Adstock 이월효과·Saturation 포화곡선) 기반 예산 최적화, CLV 엔진은 글로벌 컨설팅사
          (Bain·McKinsey·Gartner·BCG) 통합 공식으로 계산됩니다. 실행 결과는 Supabase에 저장되어 언제든 다시 불러볼 수 있습니다.
        </p>

        <div className="ba-grid">
          <div className="ba-sidebar">
            <div className="ba-panel">
              <button className="ba-btn link" onClick={fillExample} type="button">
                <Wand2 size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
                예시로 채우기 (메종드글램)
              </button>

              <label className="ba-label">브랜드명</label>
              <input className="ba-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 메종드글램" />

              <label className="ba-label">브랜드 설명 (URL 텍스트도 붙여넣기 가능)</label>
              <textarea className="ba-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="브랜드/상품/타깃에 대해 자유롭게 설명해 주세요" />

              <label className="ba-label">총 예산 (원)</label>
              <input
                className="ba-input"
                type="number"
                value={budget}
                min={100000}
                step={100000}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
              />

              <label className="ba-label">마케팅 목표</label>
              <div className="ba-chips">
                {GOALS.map((g) => (
                  <div key={g.code} className={`ba-chip ${goal === g.code ? "active" : ""}`} onClick={() => setGoal(g.code)}>
                    {g.label}
                  </div>
                ))}
              </div>

              <div className="ba-adv-toggle" onClick={() => setShowAdvanced((s) => !s)}>
                <ChevronDown size={13} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                고급: CLV 산출 파라미터
              </div>
              {showAdvanced && (
                <div className="ba-adv-grid">
                  <div>
                    <label className="ba-label">평균 객단가 AOV (원)</label>
                    <input className="ba-input" type="number" value={aov} onChange={(e) => setAov(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="ba-label">연간 구매빈도 F</label>
                    <input className="ba-input" type="number" step="0.1" value={freq} onChange={(e) => setFreq(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="ba-label">마진율 (%)</label>
                    <input className="ba-input" type="number" value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="ba-label">이탈률 Churn (%)</label>
                    <input className="ba-input" type="number" value={churnPct} onChange={(e) => setChurnPct(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="ba-label">기간당 리텐션 비용 (원)</label>
                    <input className="ba-input" type="number" value={retentionCost} onChange={(e) => setRetentionCost(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="ba-label">할인율 d / WACC (%)</label>
                    <input className="ba-input" type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value) || 0)} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="ba-label">예측 기간 T (년)</label>
                    <input className="ba-input" type="number" value={years} onChange={(e) => setYears(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                </div>
              )}

              {error && (
                <div className="ba-error">
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button className="ba-btn" onClick={runPipeline} disabled={running} type="button">
                {running ? <Loader2 size={16} className="ba-spin" /> : <Play size={16} />}
                {running ? "에이전트 실행 중..." : "AI 에이전트 실행"}
              </button>
              <button className="ba-btn ghost" onClick={reset} type="button">
                <RotateCcw size={14} style={{ marginRight: 6 }} />
                초기화
              </button>
            </div>

            <div className="ba-panel ba-history-panel">
              <div className="ba-history-head">
                <History size={13} />
                캠페인 히스토리 (Supabase)
              </div>
              {!historyLoaded && <div className="ba-history-empty">불러오는 중...</div>}
              {historyLoaded && history.length === 0 && (
                <div className="ba-history-empty">아직 저장된 캠페인이 없습니다. 실행이 끝나면 자동으로 저장됩니다.</div>
              )}
              {historyError && (
                <div className="ba-error" style={{ marginBottom: 10 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{historyError}</span>
                </div>
              )}
              <div className="ba-history-list">
                {history.map((h) => (
                  <div className="ba-history-item" key={h.id} onClick={() => loadFromHistory(h)}>
                    <div>
                      <div className="ba-history-item-name">{h.name}</div>
                      <div className="ba-history-item-meta">
                        <Clock size={10} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} />
                        {new Date(h.created_at).toLocaleString("ko-KR")} · {h.goal} · {Number(h.budget).toLocaleString()}원
                      </div>
                    </div>
                    <button
                      className="ba-history-del"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteFromHistory(h.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {stage === -1 && !results.brand && (
              <div className="ba-idle">왼쪽에서 브랜드 정보를 입력하고 &lsquo;AI 에이전트 실행&rsquo;을 눌러 파이프라인을 시작하세요.</div>
            )}

            <div className="ba-pipeline">
              {ENGINES.map((eng, i) => {
                const Icon = eng.icon;
                const isDone = stage > i || stage === ENGINES.length;
                const isActive = stage === i;
                const hasResult = (results as any)[eng.key];
                if (stage === -1 && !hasResult) return null;
                return (
                  <div className="ba-node" key={eng.key}>
                    <div className="ba-node-rail">
                      <div className={`ba-node-dot ${isDone ? "done" : isActive ? "active" : ""}`}>
                        {isActive ? <Loader2 size={16} className="ba-spin" /> : <Icon size={16} />}
                      </div>
                      {i < ENGINES.length - 1 && <div className={`ba-node-line ${isDone ? "done" : ""}`} />}
                    </div>
                    <div className="ba-node-body">
                      <div className="ba-node-head">
                        <span className="ba-node-label">{eng.label}</span>
                        <span className="ba-node-sub ba-mono">{eng.sub}</span>
                      </div>

                      {eng.key === "brand" && results.brand && (
                        <div className="ba-result">
                          <div className="ba-kv"><b>톤앤매너</b><span>{results.brand.tone}</span></div>
                          <div className="ba-kv"><b>USP</b><span>{results.brand.usp}</span></div>
                          <div className="ba-kv"><b>타깃 요약</b><span>{results.brand.target_summary}</span></div>
                          <div className="ba-tags">
                            {(results.brand.keywords || []).map((k, idx) => <span className="ba-tag" key={idx}>{k}</span>)}
                          </div>
                        </div>
                      )}

                      {eng.key === "customer" && results.personas && (
                        <div className="ba-result">
                          {results.personas.map((p, idx) => (
                            <div className="ba-persona" key={idx}>
                              <div className="ba-kv"><b>{p.name}</b><span className="ba-mono" style={{ color: "var(--dim)" }}>{p.age_group}</span></div>
                              <div className="ba-kv"><b>페인포인트</b><span>{p.pain_point}</span></div>
                              <div className="ba-kv"><b>결정요인</b><span>{p.decision_factor}</span></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {eng.key === "strategy" && results.strategy && (
                        <div className="ba-result">
                          {(results.strategy.channels || []).map((c, idx) => (
                            <div className="ba-bar-row" key={idx}>
                              <div className="ba-bar-top"><span>{c.name}</span><span className="ba-mono">{c.percent}%</span></div>
                              <div className="ba-bar-track"><div className="ba-bar-fill" style={{ width: `${c.percent}%` }} /></div>
                              <div className="ba-bar-reason ba-mono">
                                지출 {c.spend.toLocaleString()}원 · 효과지수 {c.response} · Adstock λ {c.decay}
                              </div>
                              <div className="ba-bar-reason">{c.reason}</div>
                            </div>
                          ))}
                          {results.strategy.summary && (
                            <div style={{ marginTop: 10, color: "var(--dim)" }}>{results.strategy.summary}</div>
                          )}
                        </div>
                      )}

                      {eng.key === "creative" && results.creative && (
                        <div className="ba-result">
                          {(results.creative.copies || []).map((c, idx) => (
                            <div className="ba-copy-card" key={idx}>
                              <div className="ba-copy-head">{c.headline}</div>
                              <div className="ba-copy-body">{c.body}</div>
                            </div>
                          ))}
                          {results.creative.short_form_concept && (
                            <div className="ba-copy-card" style={{ borderColor: "var(--violet)" }}>
                              <div className="ba-copy-head" style={{ color: "var(--violet)" }}>숏폼 컨셉 (15초)</div>
                              <div className="ba-copy-body">{results.creative.short_form_concept}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {eng.key === "media" && results.media && (
                        <div className="ba-result">
                          {results.media.map((m, idx) => (
                            <div className="ba-bar-row" key={idx}>
                              <div className="ba-bar-top"><span>{m.name}</span><span className="ba-mono">{m.score}점</span></div>
                              <div className="ba-bar-track"><div className="ba-bar-fill" style={{ width: `${m.score}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {eng.key === "analytics" && results.analytics && (
                        <div className="ba-result">
                          {[
                            { label: "노출 (Awareness)", value: results.analytics.impressions, color: "var(--violet)" },
                            { label: "클릭 (Consideration)", value: results.analytics.clicks, color: "#A18CFF" },
                            { label: "전환 (Conversion)", value: results.analytics.conversions, color: "var(--amber)" },
                          ].map((f, idx) => (
                            <div className="ba-funnel-row" key={idx}>
                              <div className="ba-funnel-top"><span>{f.label}</span><span className="ba-mono">{f.value.toLocaleString()}</span></div>
                              <div className="ba-funnel-track">
                                <div
                                  className="ba-funnel-fill"
                                  style={{
                                    width: `${Math.max(4, (f.value / results.analytics!.impressions) * 100)}%`,
                                    background: f.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                          <div className="ba-trigger">
                            <b>Conversion Friction Analyzer</b><br />{results.analytics.trigger}
                          </div>
                        </div>
                      )}

                      {eng.key === "clv" && results.clv && (
                        <div className="ba-result">
                          <div className="ba-clv-grid">
                            <div className="ba-clv-metric">
                              <div className="ba-clv-metric-label">M_t · 기간당 순마진</div>
                              <div className="ba-clv-metric-value">{results.clv.mt.toLocaleString()}원</div>
                            </div>
                            <div className="ba-clv-metric">
                              <div className="ba-clv-metric-label">CAC · 고객획득비용</div>
                              <div className="ba-clv-metric-value">{results.clv.cac.toLocaleString()}원</div>
                            </div>
                            <div className="ba-clv-metric">
                              <div className="ba-clv-metric-label">LTV · 할인 총가치 (Σ)</div>
                              <div className="ba-clv-metric-value">{results.clv.ltv.toLocaleString()}원</div>
                            </div>
                            <div className="ba-clv-metric">
                              <div className="ba-clv-metric-label">CLV (LTV − CAC)</div>
                              <div className="ba-clv-metric-value">{results.clv.clv.toLocaleString()}원</div>
                            </div>
                          </div>

                          <div>
                            CLV : CAC 비율
                            <span className={`ba-clv-ratio-badge ${results.clv.healthy ? "good" : "warn"}`}>
                              {results.clv.ratio !== null ? `${results.clv.ratio} : 1` : "N/A"}
                            </span>
                            <span style={{ color: "var(--dim)", fontSize: 12, marginLeft: 6 }}>
                              (목표 기준 3:1 이상 {results.clv.healthy ? "충족" : "미달"})
                            </span>
                          </div>

                          <div className="ba-clv-periods">
                            {results.clv.periods.map((row) => (
                              <div key={row.t}>
                                t={row.t}년 · R_t={row.Rt.toFixed(2)} · 할인가치 {Math.round(row.value).toLocaleString()}원
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {stage === ENGINES.length && (
              <>
                <div className="ba-state-toggle" onClick={() => setShowState((s) => !s)}>
                  <ChevronDown size={13} style={{ transform: showState ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  Campaign State (JSON) 보기
                </div>
                {showState && <div className="ba-state-json">{JSON.stringify(results, null, 2)}</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
