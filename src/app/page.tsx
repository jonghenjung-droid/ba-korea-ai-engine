"use client";

import { useEffect, useState } from "react";
import {
  Layers, Users, Target, Sparkles, Radar, LineChart, Repeat,
  Play, RotateCcw, Loader2, ChevronDown, AlertCircle, Wand2, History, Trash2, Clock,
  Rss, Plus, X, Gauge, Film, Tag, PenTool, FileText, Briefcase, Copy, Check,
} from "lucide-react";
import {
  Brand, Persona, MediaScore, Strategy, Analytics, CLVResult, ROASResult, BlendedROAS, ChannelCalibration,
  extractJSON, runMediaEngine, computeMMMAllocation, computeChannelROAS, computeBlendedROAS, runAnalyticsEngine, runCLVEngine,
  FRAMEWORK_BY_GOAL,
} from "@/lib/engines";

type CreativeCopy = { headline: string; body: string; framework?: string; framework_breakdown?: { step: string; text: string }[] };
type Creative = { copies: CreativeCopy[]; short_form_concept: string };

type Results = {
  brand: Brand | null;
  personas: Persona[] | null;
  strategy: Strategy | null;
  creative: Creative | null;
  media: MediaScore[] | null;
  analytics: Analytics | null;
  clv: CLVResult | null;
  roas: { channels: ROASResult[]; blended: BlendedROAS } | null;
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
  { key: "customer", label: "Customer Engine", sub: "라이프스타일 페르소나 생성", icon: Users },
  { key: "media", label: "Media Engine", sub: "페르소나×채널 친화도 매칭", icon: Radar },
  { key: "strategy", label: "Strategy Engine", sub: "MMM 예산 최적화 (Adstock·Saturation·친화도)", icon: Target },
  { key: "creative", label: "Creative Engine", sub: "카피라이팅 프레임워크 기반 크리에이티브", icon: Sparkles },
  { key: "analytics", label: "Analytics Engine", sub: "채널별 ROAS 합산 퍼널 & 트리거", icon: LineChart },
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

const EMPTY_RESULTS: Results = { brand: null, personas: null, strategy: null, creative: null, media: null, analytics: null, clv: null, roas: null };

type OutputId = "brand_diagnosis" | "marketing_diagnosis" | "storyboard" | "naming_slogan" | "content_proposal" | "brand_proposal";

const OUTPUT_DEFS: { id: OutputId; label: string; icon: any; system: string; maxTokens: number; cta?: { label: string; url: string }; group: "diagnosis" | "creative" }[] = [
  {
    id: "brand_diagnosis",
    label: "브랜드 방향 무료진단 (RTB 체크)",
    icon: Tag,
    system:
      "너는 CBO(Chief Brand Officer) 출신 브랜드 컨설턴트다. 주어진 브랜드 DNA·페르소나·전략 데이터를 근거로, 이 브랜드가 인지→신뢰→재방문→단골 4단계 중 어디쯤 있고 어디서 막힐 위험이 큰지 진단한다. 특히 RTB(Reason To Buy, '왜 다시 이 브랜드를 찾아야 하는가'에 대한 근거)가 데이터상 명확한지 점검한다. 정확히 4개 항목(막힌 단계 진단, RTB 명확성, 근거, 다음 액션 힌트 1개)만 3~4문장씩 간결하게 제시하고, 장황한 서론은 생략한다. 전체 분량은 700단어를 넘기지 마라. 이것은 무료 예비진단이므로 확정적 처방이 아니라 방향 힌트 수준으로만 제시한다. 마크다운 헤더(##)를 사용하라.",
    maxTokens: 3000,
    cta: { label: "정밀 진단 + 실행 가이드 컨설팅 (599,000원~)", url: "https://kmong.com/gig/806486" },
    group: "diagnosis",
  },
  {
    id: "marketing_diagnosis",
    label: "마케팅 무료 진단",
    icon: Target,
    system:
      "너는 종합 마케팅 전략 컨설턴트다. 주어진 미디어 믹스(채널별 예산배분), ROAS, Analytics 데이터를 근거로 이 마케팅 전략의 강점 2가지와 리스크 3가지를 진단한다. 예산 배분이 실제로 타깃·목표에 맞게 짜여 있는지, 채널 조합에 놓치고 있는 사각지대는 없는지, 예상 성과(ROAS·전환)가 목표 대비 충분한지를 점검한다. 억지로 문제를 만들지 말고 데이터상 실제 근거가 있는 부분만 짚는다. 전체 분량은 700단어를 넘기지 마라. 이것은 무료 예비진단이므로 확정적 판단이 아니라 점검 힌트 수준으로만 제시한다. 마크다운 헤더(##)를 사용하라.",
    maxTokens: 3000,
    cta: { label: "종합 마케팅 전략 컨설팅 문의", url: "https://kmong.com/@BrandAccelerator" },
    group: "diagnosis",
  },
  {
    id: "storyboard",
    label: "15초 영상광고 스토리보드·콘티",
    icon: Film,
    system:
      "너는 칸 라이언즈(Cannes Lions) 수상 경력의 글로벌 CF 감독 겸 스토리보드 아티스트다. 주어진 브랜드/캠페인 정보를 바탕으로 15초 영상광고의 씬별 스토리보드를 콘티 형식으로 작성한다. 반드시 5~6개 씬으로만 구성하고(15초를 초과하지 않도록), 각 씬 설명은 타임코드 + 화면 설명(카메라 앵글·구도) + 대사/자막 + 사운드 디렉션을 합쳐 3문장 이내로 간결하게 작성한다. 장황한 서술 없이, 실제 촬영 현장에서 바로 참고할 수 있는 압축된 콘티 형식을 유지하라. 마지막에 연출 의도를 1~2문장으로 요약한다. 전체 분량은 반드시 1200단어를 넘기지 마라. 마크다운 헤더(##)와 목록을 사용하라.",
    maxTokens: 8000,
    group: "creative",
  },
  {
    id: "naming_slogan",
    label: "브랜드 네이밍 및 슬로건",
    icon: PenTool,
    system:
      "너는 Interbrand·Landor 수준의 글로벌 브랜드 네이밍·슬로건 전문가다. 주어진 브랜드 DNA와 타깃을 바탕으로 (1) 캠페인/서브브랜드 네이밍 후보 3개와 각각의 근거(어원·발음·기억용이성), (2) 브랜드 슬로건 후보 3개(국문 1개 + 국문/영문 조합 2개)를 제시한다. 각 항목은 3문장 이내로 간결하게 작성하고, 부연 설명이나 서론은 생략한다. 전체 분량은 반드시 900단어를 넘기지 마라. 마크다운 헤더(##)와 목록을 사용해 작성하라.",
    maxTokens: 6000,
    cta: { label: "브랜드 비전·미션 설계 컨설팅 (599,000원~)", url: "https://kmong.com/gig/806486" },
    group: "creative",
  },
  {
    id: "content_proposal",
    label: "콘텐츠 마케팅 제안서",
    icon: FileText,
    system:
      "너는 글로벌 톱티어 콘텐츠 마케팅 전략가다. 주어진 브랜드/타깃/전략 정보를 바탕으로 3개월 콘텐츠 마케팅 제안서를 작성한다. 콘텐츠 필러(축) 정확히 3개, 채널별 콘텐츠 유형과 발행 빈도(표 형식), 월별 캘린더 개요(각 달 1~2줄), 성과 측정 KPI 3~5개만 간결하게 제시하고, 장황한 서론·결론은 생략한다. 전체 분량은 A4 1.5페이지 분량(약 1500단어)을 넘기지 마라. 마크다운 헤더(#, ##)와 목록을 사용해 문서 구조를 명확히 하라.",
    maxTokens: 7500,
    group: "creative",
  },
  {
    id: "brand_proposal",
    label: "브랜드 마케팅 제안서",
    icon: Briefcase,
    system:
      "너는 Bain·McKinsey 브랜드 프랙티스 수준의 글로벌 브랜드 컨설팅 파트너다. 주어진 모든 캠페인 데이터(브랜드 DNA, 타깃, MMM 예산배분, ROAS, CLV)를 근거로 종합 브랜드 마케팅 제안서를 작성한다. Executive Summary(3~4문장), 브랜드 포지셔닝(짧은 문단), 3개년 성장 로드맵(연차별 1~2줄), 예산 배분 근거(짧은 문단), 기대 효과(불릿 3~5개)로만 구성하고, 장황한 부연 설명은 생략한다. 전체 분량은 A4 2페이지 분량(약 2000단어)을 넘기지 마라. 마크다운 헤더(#, ##)와 목록을 사용해 문서 구조를 명확히 하라.",
    maxTokens: 7500,
    cta: { label: "브랜드 비전·미션 설계 컨설팅 (599,000원~)", url: "https://kmong.com/gig/806486" },
    group: "creative",
  },
];

function buildContextPrompt(r: Results, meta: { name: string; desc: string; goal: string; budget: number }) {
  return `브랜드명: ${meta.name}\n브랜드 설명: ${meta.desc}\n마케팅 목표: ${meta.goal}\n총 예산: ${meta.budget.toLocaleString()}원\n\nBrand DNA: ${JSON.stringify(r.brand)}\nPersonas: ${JSON.stringify(r.personas)}\nStrategy(MMM 배분): ${JSON.stringify(r.strategy)}\n기존 Creative 결과: ${JSON.stringify(r.creative)}\nROAS: ${JSON.stringify(r.roas)}\nAnalytics: ${JSON.stringify(r.analytics)}\nCLV: ${JSON.stringify(r.clv)}\n\n위 데이터를 최대한 근거로 활용해 산출물을 작성하라. 데이터에 없는 부분은 브랜드 톤에 맞게 전문가로서 합리적으로 채워도 된다.`;
}

function renderLite(text: string) {
  const lines = text.split("\n");
  const blocks: JSX.Element[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function renderInline(line: string) {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>
    );
  }

  function flushList() {
    if (listBuffer.length > 0) {
      blocks.push(
        <ul className="ba-md-list" key={`ul-${key++}`}>
          {listBuffer.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      );
      listBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("### ")) { flushList(); blocks.push(<h4 className="ba-md-h4" key={key++}>{renderInline(line.slice(4))}</h4>); }
    else if (line.startsWith("## ")) { flushList(); blocks.push(<h3 className="ba-md-h3" key={key++}>{renderInline(line.slice(3))}</h3>); }
    else if (line.startsWith("# ")) { flushList(); blocks.push(<h2 className="ba-md-h2" key={key++}>{renderInline(line.slice(2))}</h2>); }
    else if (line.startsWith("- ") || line.startsWith("* ")) { listBuffer.push(line.slice(2)); }
    else if (line === "") { flushList(); }
    else { flushList(); blocks.push(<p className="ba-md-p" key={key++}>{renderInline(line)}</p>); }
  }
  flushList();
  return blocks;
}

async function callClaude(system: string, prompt: string) {
  const res = await fetch("/api/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 호출 실패 (${res.status})`);
  if (data.truncated) throw new Error("응답이 길이 제한으로 잘렸습니다. 잠시 후 다시 시도해 주세요.");
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
  const [showMethodology, setShowMethodology] = useState(false);
  const [showDataLoop, setShowDataLoop] = useState(false);
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

  const [trackedKeywords, setTrackedKeywords] = useState<{ keyword: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [sourceScores, setSourceScores] = useState<{ source: string; score: number; sample_size: number }[]>([]);
  const [channelCalibration, setChannelCalibration] = useState<{ channel: string; multiplier: number; sample_size: number }[]>([]);
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ channel: "", actual_ctr: "", actual_cvr: "", actual_roas: "", notes: "" });
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  const [outputs, setOutputs] = useState<Record<string, { loading: boolean; text: string | null; error: string | null; truncated?: boolean }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const running = stage >= 0 && stage < ENGINES.length;

  // 초기 로딩 시 4개의 독립적인 GET을 병렬로 실행 (기존엔 순차 대기라 첫 화면이 그만큼 늦게 완성됐음)
  useEffect(() => {
    async function loadKeywords() {
      try {
        const res = await fetch("/api/market/keywords");
        const data = await res.json();
        if (res.ok) setTrackedKeywords(data.keywords || []);
      } catch (e) {
        // 키워드 목록은 부가 기능이므로 실패해도 조용히 무시
      }
    }
    async function loadFeedbackScores() {
      try {
        const res = await fetch("/api/feedback");
        const data = await res.json();
        if (res.ok) setSourceScores(data.sourceScores || []);
      } catch (e) {
        // 소스 점수도 부가 기능이므로 조용히 무시
      }
    }
    async function loadCalibration() {
      try {
        const res = await fetch("/api/market/calibration");
        const data = await res.json();
        if (res.ok) setChannelCalibration(data.calibration || []);
      } catch (e) {
        // 보정값도 부가 기능이므로 조용히 무시
      }
    }
    async function loadHistory() {
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
    }
    Promise.allSettled([loadKeywords(), loadFeedbackScores(), loadCalibration(), loadHistory()]);
  }, []);

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    try {
      const res = await fetch("/api/market/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTrackedKeywords((k) => [data.keyword, ...k.filter((x) => x.keyword !== data.keyword.keyword)]);
        setNewKeyword("");
      }
    } catch (e) {
      // 무시 - 부가 기능
    }
  }

  async function removeKeyword(keyword: string) {
    setTrackedKeywords((k) => k.filter((x) => x.keyword !== keyword));
    try {
      await fetch(`/api/market/keywords?keyword=${encodeURIComponent(keyword)}`, { method: "DELETE" });
    } catch (e) {
      // 무시
    }
  }

  async function runIngestNow() {
    setIngesting(true);
    setIngestStatus(null);
    try {
      const res = await fetch("/api/market/ingest");
      const data = await res.json();
      if (!res.ok) {
        setIngestStatus(data.error || "수집 실패");
      } else if (data.error) {
        setIngestStatus(data.error);
      } else {
        setIngestStatus(`시그널 ${data.signals_ingested ?? 0}건, 문서 ${data.documents_ingested ?? 0}건 수집 완료`);
      }
    } catch (e: any) {
      setIngestStatus("수집 중 오류가 발생했습니다.");
    } finally {
      setIngesting(false);
    }
  }

  async function submitFeedback(campaignId: string) {
    setFeedbackStatus(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          channel: feedbackForm.channel || null,
          actual_ctr: feedbackForm.actual_ctr ? Number(feedbackForm.actual_ctr) : null,
          actual_cvr: feedbackForm.actual_cvr ? Number(feedbackForm.actual_cvr) : null,
          actual_roas: feedbackForm.actual_roas ? Number(feedbackForm.actual_roas) : null,
          notes: feedbackForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackStatus(data.error || "저장 실패");
        return;
      }
      setFeedbackStatus("피드백이 저장되었고, 참고했던 데이터 소스·채널 학습 보정값이 갱신되었습니다.");
      setFeedbackForm({ channel: "", actual_ctr: "", actual_cvr: "", actual_roas: "", notes: "" });
      const scoresRes = await fetch("/api/feedback");
      const scoresData = await scoresRes.json();
      if (scoresRes.ok) setSourceScores(scoresData.sourceScores || []);
      const calRes = await fetch("/api/market/calibration");
      const calData = await calRes.json();
      if (calRes.ok) setChannelCalibration(calData.calibration || []);
    } catch (e) {
      setFeedbackStatus("피드백 저장 중 오류가 발생했습니다.");
    }
  }

  async function generateOutput(def: (typeof OUTPUT_DEFS)[number]) {
    setOutputs((o) => ({ ...o, [def.id]: { loading: true, text: null, error: null } }));
    try {
      const prompt = buildContextPrompt(results, { name, desc, goal, budget });
      const res = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: def.system, prompt, max_tokens: def.maxTokens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOutputs((o) => ({ ...o, [def.id]: { loading: false, text: null, error: data.error || "생성 실패" } }));
        return;
      }
      setOutputs((o) => ({ ...o, [def.id]: { loading: false, text: data.text, error: null, truncated: !!data.truncated } }));
    } catch (e: any) {
      setOutputs((o) => ({ ...o, [def.id]: { loading: false, text: null, error: "생성 중 오류가 발생했습니다." } }));
    }
  }

  function copyOutput(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

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
        "너는 AI Customer Engine이다. Brand DNA를 바탕으로 핵심 타깃 페르소나 3개를 JSON으로만 생성한다. 각 페르소나는 실제 미디어 소비 습관(라이프스타일)을 구체적으로 반영해야 하며, 채널마다 동일한 weight를 주는 것은 금지한다.",
        `Brand DNA: ${JSON.stringify(brand)}\n\n다음 형식의 JSON으로만 답하라 (channel 값은 반드시 아래 5개 중에서만 사용: "메타 (Meta)", "네이버 검색광고", "카카오모먼트", "유튜브", "틱톡 / 숏폼"):\n{"personas":[{"name":"페르소나 이름(예: 3040 워킹맘 지현)","age_group":"연령대","pain_point":"핵심 페인포인트 한 문장","decision_factor":"구매 결정 요인 한 문장","audience_share":0.4,"lifestyle":{"active_hours":["morning_commute"|"lunch"|"after_work"|"weekend"|"late_night"],"primary_platforms":[{"channel":"채널명","purpose":"discovery"|"verification"|"immersion"|"conversion","weight":0.0}],"content_format_pref":["short_form"|"long_form"|"text"|"live"],"journey_touchpoints":[{"stage":"awareness"|"consideration"|"decision","channel":"채널명"}]}}] } 총 3개 항목, audience_share 합계는 1.0`
      );
      const personas: Persona[] = customer.personas || [];
      setResults((r) => ({ ...r, personas }));

      setStage(2);
      const media = runMediaEngine(personas);
      setResults((r) => ({ ...r, media }));

      setStage(3);
      const calibrationMap: ChannelCalibration = Object.fromEntries(channelCalibration.map((c) => [c.channel, c.multiplier]));
      const optimized = computeMMMAllocation(media, budget, calibrationMap);

      // 4단계: RAG - 실시간 수집 데이터(시그널/문서)에서 관련 컨텍스트 조회
      // 추적 키워드가 없으면 애초에 데이터가 쌓였을 리 없으므로, 불필요한 API 왕복을 생략한다.
      let ragContext = "";
      let ragSources: string[] = [];
      if (trackedKeywords.length > 0) {
        try {
          const ragRes = await fetch("/api/market/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: `${brand.tone} ${brand.usp} ${goal}`, keywords: brand.keywords }),
          });
          const ragData = await ragRes.json();
          if (ragRes.ok && ragData.hasData) {
            const docLines = (ragData.documents || []).map((d: any) => `- [${d.source}] ${d.title || d.content}`).join("\n");
            const sigLines = (ragData.signals || [])
              .slice(0, 5)
              .map((s: any) => `- [${s.source}] ${s.keyword}: ${s.metric}=${s.value}`)
              .join("\n");
            ragContext = `\n\n실시간 시장 데이터 (참고):\n${docLines}\n${sigLines}`;
            ragSources = Array.from(
              new Set([...(ragData.documents || []).map((d: any) => d.source), ...(ragData.signals || []).map((s: any) => s.source)])
            );
          }
        } catch (e) {
          // RAG 조회 실패는 전체 파이프라인을 막지 않음 - 시장 데이터 없이 진행
        }
      }

      const narrative = await callClaude(
        "너는 AI Strategy Engine이다. MMM(Adstock·Saturation·페르소나 친화도) 최적화 엔진이 이미 산출한 채널별 예산 배분 결과에 대해, 브랜드/타깃 관점의 배정 이유를 채널마다 한 문장씩 설명하고 전체 전략을 한 줄로 요약한다. 실시간 시장 데이터가 주어지면 그 추세도 반영해서 설명한다. 배분 비율(percent) 자체는 절대 바꾸지 말고 이유만 작성한다. JSON으로만 답하라.",
        `Brand DNA: ${JSON.stringify(brand)}\nPersonas: ${JSON.stringify(personas)}\n마케팅 목표: ${goal}\nMMM 최적화 배분 결과: ${JSON.stringify(optimized.map((o) => ({ name: o.name, percent: o.percent })))}${ragContext}\n\n다음 형식의 JSON으로만 답하라:\n{"channel_reasons":[{"name":"채널명","reason":"배정 이유 한 문장"}], "summary":"전체 전략 한 줄 요약"}`
      );
      const reasonMap: Record<string, string> = Object.fromEntries(
        (narrative.channel_reasons || []).map((c: any) => [c.name, c.reason])
      );
      const strategy: Strategy = {
        channels: optimized.map((o) => ({ ...o, reason: reasonMap[o.name] || "" })),
        summary: narrative.summary || "",
        ragSources,
      };
      setResults((r) => ({ ...r, strategy }));

      // Strategy Engine 배분 결과 + 업계 벤치마크 + AOV로 채널별 추정 ROAS (섹션 6)
      const channelROAS = computeChannelROAS(strategy.channels, aov);

      setStage(4);
      const frameworks = FRAMEWORK_BY_GOAL[goal] || FRAMEWORK_BY_GOAL["인지도"];
      const creative: Creative = await callClaude(
        "너는 AI Creative Engine이다. 브랜드 DNA와 전략을 바탕으로 광고 카피와 숏폼 컨셉을 JSON으로만 생성한다. 지정된 카피라이팅 프레임워크의 단계를 실제로 따라 자연스럽게 작성하고, 억지로 끼워맞추지 않는다.",
        `Brand DNA: ${JSON.stringify(brand)}\n전략 요약: ${strategy.summary || ""}\n사용 가능한 카피라이팅 프레임워크: ${JSON.stringify(frameworks)}\n\n다음 형식의 JSON으로만 답하라 (copies 3개, 프레임워크는 위 후보 중에서 선택하되 다양하게 섞어도 됨):\n{"copies":[{"headline":"헤드라인","body":"서브카피 한 문장","framework":"사용한 프레임워크명","framework_breakdown":[{"step":"단계명","text":"카피 중 이 단계에 해당하는 부분"}]}], "short_form_concept":"15초 숏폼 영상 컨셉 한 단락"}`
      );
      setResults((r) => ({ ...r, creative }));

      setStage(5);
      const analytics = runAnalyticsEngine(channelROAS, goal);
      setResults((r) => ({ ...r, analytics }));

      setStage(6);
      const clv = runCLVEngine(budget, analytics, { aov, freq, marginPct, churnPct, retentionCost, discountPct, years });
      setResults((r) => ({ ...r, clv }));

      const blended = computeBlendedROAS(channelROAS, budget, clv.ltv);
      const roas = { channels: channelROAS, blended };
      setResults((r) => ({ ...r, roas }));

      setStage(7);
      await saveCampaignToHistory({
        name, description: desc, goal, budget,
        results: { brand, personas, strategy, creative, media, analytics, clv, roas },
      });
    } catch (e: any) {
      setError("AI 엔진 실행 중 오류가 발생했습니다: " + e.message);
      setStage(-1);
    }
  }

  return (
    <div className="ba-root">
      <div className="ba-wrap">
        <div className="ba-eyebrow">BA KOREA · AI GROWTH AGENT</div>
        <h1 className="ba-title">AI Growth Agent</h1>
        <p className="ba-sub">
          브랜드 캠페인 시뮬레이션(Brand→Customer→Media→Strategy→Creative→Analytics→CLV 7개 엔진)부터, 사업계획서·제안서·행사 기획의
          무료 사전진단까지 — BA KOREA의 실제 컨설팅 노하우를 AI로 먼저 체험해보는 도구입니다.
        </p>

        <div className="ba-methodology-toggle" onClick={() => setShowMethodology((s) => !s)}>
          <ChevronDown size={12} style={{ transform: showMethodology ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          엔진 작동 방식 자세히 보기
        </div>
        {showMethodology && (
          <p className="ba-sub ba-methodology-detail">
            Customer Engine이 만든 페르소나의 라이프스타일(채널 습관·비중)이 Media Engine의 채널 친화도 매칭에 그대로 연결되고, Strategy 엔진은
            Meta Robyn·Google LightweightMMM 방법론(Adstock 이월효과·Saturation 포화곡선) × 그 친화도 × 실제 성과로 학습된 보정값을 곱해 예산을 최적화합니다.
            Creative Engine은 마케팅 목표에 맞는 카피라이팅 프레임워크(AIDA·PAS·StoryBrand·Cialdini)를 선택해 카피를 생성하고, Analytics Engine은
            Strategy의 채널별 배분·ROAS 계산과 동일한 숫자를 그대로 합산해 퍼널을 산출합니다. CLV 엔진은 글로벌 컨설팅사(Bain·McKinsey·Gartner·BCG)
            통합 공식으로 계산되며, 실행 결과는 Supabase에 저장되어 언제든 다시 불러볼 수 있습니다.
          </p>
        )}

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
                  <div key={h.id}>
                    <div className="ba-history-item" onClick={() => loadFromHistory(h)}>
                      <div>
                        <div className="ba-history-item-name">{h.name}</div>
                        <div className="ba-history-item-meta">
                          <Clock size={10} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} />
                          {new Date(h.created_at).toLocaleString("ko-KR")} · {h.goal} · {Number(h.budget).toLocaleString()}원
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="ba-history-del"
                          type="button"
                          title="실제 성과 입력"
                          onClick={(e) => { e.stopPropagation(); setFeedbackOpenId(feedbackOpenId === h.id ? null : h.id); setFeedbackStatus(null); }}
                        >
                          <Gauge size={14} />
                        </button>
                        <button
                          className="ba-history-del"
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteFromHistory(h.id); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {feedbackOpenId === h.id && (
                      <div className="ba-feedback-form" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="ba-input"
                          style={{ marginBottom: 8 }}
                          placeholder="채널명 (예: 메타 (Meta))"
                          value={feedbackForm.channel}
                          onChange={(e) => setFeedbackForm((f) => ({ ...f, channel: e.target.value }))}
                        />
                        <div className="ba-adv-grid">
                          <input className="ba-input" type="number" step="0.001" placeholder="실제 CTR (예: 0.02)" value={feedbackForm.actual_ctr} onChange={(e) => setFeedbackForm((f) => ({ ...f, actual_ctr: e.target.value }))} />
                          <input className="ba-input" type="number" step="0.001" placeholder="실제 CVR (예: 0.04)" value={feedbackForm.actual_cvr} onChange={(e) => setFeedbackForm((f) => ({ ...f, actual_cvr: e.target.value }))} />
                        </div>
                        <input className="ba-input" type="number" step="0.1" placeholder="실제 ROAS (예: 2.5)" value={feedbackForm.actual_roas} onChange={(e) => setFeedbackForm((f) => ({ ...f, actual_roas: e.target.value }))} />
                        <textarea className="ba-textarea" placeholder="메모 (선택)" value={feedbackForm.notes} onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))} />
                        {feedbackStatus && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>{feedbackStatus}</div>}
                        <button className="ba-btn" type="button" onClick={() => submitFeedback(h.id)}>성과 저장 & 소스 신뢰도 갱신</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="ba-panel ba-history-panel">
              <div className="ba-history-head ba-collapsible-head" onClick={() => setShowDataLoop((s) => !s)}>
                <Rss size={13} />
                고급: 실시간 시장 데이터 & 자동학습
                <ChevronDown size={12} style={{ marginLeft: "auto", transform: showDataLoop ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </div>
              {showDataLoop && (
                <div style={{ marginTop: 12 }}>
              <label className="ba-label">추적 키워드</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input
                  className="ba-input"
                  style={{ marginBottom: 0 }}
                  placeholder="예: 글램핑, 프리미엄 캠핑"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                />
                <button className="ba-btn" style={{ width: 44 }} type="button" onClick={addKeyword}><Plus size={16} /></button>
              </div>
              <div className="ba-tags" style={{ marginBottom: 12 }}>
                {trackedKeywords.map((k) => (
                  <span className="ba-tag" key={k.keyword} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {k.keyword}
                    <X size={11} style={{ cursor: "pointer" }} onClick={() => removeKeyword(k.keyword)} />
                  </span>
                ))}
                {trackedKeywords.length === 0 && <span className="ba-history-empty">추적 중인 키워드가 없습니다.</span>}
              </div>

              <button className="ba-btn ghost" type="button" onClick={runIngestNow} disabled={ingesting}>
                {ingesting ? <Loader2 size={14} className="ba-spin" /> : <Rss size={14} />}
                {ingesting ? "수집 중..." : "지금 수집 실행 (수동)"}
              </button>
              {ingestStatus && <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 8 }}>{ingestStatus}</div>}

              {sourceScores.length > 0 && (
                <>
                  <label className="ba-label" style={{ marginTop: 14 }}>데이터 소스 신뢰도 (피드백 루프로 갱신)</label>
                  {sourceScores.map((s) => (
                    <div className="ba-bar-row" key={s.source}>
                      <div className="ba-bar-top"><span className="ba-mono">{s.source}</span><span className="ba-mono">{(s.score * 100).toFixed(0)}점 (n={s.sample_size})</span></div>
                      <div className="ba-bar-track"><div className="ba-bar-fill" style={{ width: `${s.score * 100}%` }} /></div>
                    </div>
                  ))}
                </>
              )}

              {channelCalibration.length > 0 && (
                <>
                  <label className="ba-label" style={{ marginTop: 14 }}>채널 학습 보정값 (실제 성과 기반 자동 재학습)</label>
                  {channelCalibration.map((c) => (
                    <div className="ba-bar-row" key={c.channel}>
                      <div className="ba-bar-top"><span className="ba-mono">{c.channel}</span><span className="ba-mono">{Number(c.multiplier).toFixed(2)}x (n={c.sample_size})</span></div>
                      <div className="ba-bar-track"><div className="ba-bar-fill" style={{ width: `${Math.min(100, (Number(c.multiplier) / 3) * 100)}%` }} /></div>
                    </div>
                  ))}
                </>
              )}
                </div>
              )}
            </div>
          </div>

          <div>
            {stage === -1 && !results.brand && (
              <div className="ba-idle">왼쪽에서 브랜드 정보를 입력하고 &lsquo;AI 에이전트 실행&rsquo;을 눌러 파이프라인을 시작하세요.</div>
            )}

            {stage === ENGINES.length && (
              <div className="ba-quicknav">
                <a href="#engine-strategy">전략</a>
                <a href="#section-roas">ROAS</a>
                <a href="#engine-clv">CLV</a>
                <a href="#section-diagnosis">무료진단</a>
                <a href="#section-creative">실행물</a>
                <a href="#section-state">원본데이터</a>
              </div>
            )}

            <div className="ba-pipeline">
              {ENGINES.map((eng, i) => {
                const Icon = eng.icon;
                const isDone = stage > i || stage === ENGINES.length;
                const isActive = stage === i;
                const hasResult = (results as any)[eng.key];
                if (stage === -1 && !hasResult) return null;
                return (
                  <div className="ba-node" key={eng.key} id={`engine-${eng.key}`}>
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
                              <div className="ba-kv">
                                <b>{p.name}</b>
                                <span className="ba-mono" style={{ color: "var(--dim)" }}>
                                  {p.age_group} · 비중 {Math.round((p.audience_share ?? 0) * 100)}%
                                </span>
                              </div>
                              <div className="ba-kv"><b>페인포인트</b><span>{p.pain_point}</span></div>
                              <div className="ba-kv"><b>결정요인</b><span>{p.decision_factor}</span></div>
                              {p.lifestyle?.primary_platforms && p.lifestyle.primary_platforms.length > 0 && (
                                <div className="ba-tags" style={{ marginTop: 6 }}>
                                  {p.lifestyle.primary_platforms.map((pl, pidx) => (
                                    <span className="ba-tag" key={pidx}>{pl.channel} {Math.round(pl.weight * 100)}%</span>
                                  ))}
                                </div>
                              )}
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
                                지출 {c.spend.toLocaleString()}원 · 실현효과지수 {c.response} (원천 {c.rawEffect} × 친화도 {Math.round(c.affinity * 100)}%) · Adstock λ {c.decay} · 학습보정 {c.calibration}x
                              </div>
                              <div className="ba-bar-reason">{c.reason}</div>
                            </div>
                          ))}
                          {results.strategy.summary && (
                            <div style={{ marginTop: 10, color: "var(--dim)" }}>{results.strategy.summary}</div>
                          )}
                          {results.strategy.ragSources && results.strategy.ragSources.length > 0 && (
                            <div className="ba-tags" style={{ marginTop: 8 }}>
                              <span style={{ fontSize: 11, color: "var(--dim)" }}>참고한 실시간 시장 데이터 소스:</span>
                              {results.strategy.ragSources.map((s, idx) => <span className="ba-tag" key={idx}>{s}</span>)}
                            </div>
                          )}
                        </div>
                      )}

                      {eng.key === "creative" && results.creative && (
                        <div className="ba-result">
                          {(results.creative.copies || []).map((c, idx) => (
                            <div className="ba-copy-card" key={idx}>
                              <div className="ba-copy-head">
                                {c.headline}
                                {c.framework && <span className="ba-framework-badge">{c.framework}</span>}
                              </div>
                              <div className="ba-copy-body">{c.body}</div>
                              {c.framework_breakdown && c.framework_breakdown.length > 0 && (
                                <div className="ba-framework-breakdown">
                                  {c.framework_breakdown.map((f, fidx) => (
                                    <div key={fidx}><b>[{f.step}]</b> {f.text}</div>
                                  ))}
                                </div>
                              )}
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

            {results.roas && (
              <div className="ba-result" style={{ marginTop: 16 }} id="section-roas">
                <div className="ba-node-label" style={{ marginBottom: 10 }}>예상 ROAS (Strategy Engine 배분 기반, AI 추정)</div>
                {results.roas.channels.map((c, idx) => (
                  <div className="ba-bar-row" key={idx}>
                    <div className="ba-bar-top"><span>{c.channel}</span><span className="ba-mono">{c.roas}x</span></div>
                    <div className="ba-bar-track"><div className="ba-bar-fill" style={{ width: `${Math.min(100, (c.roas / 5) * 100)}%` }} /></div>
                    <div className="ba-bar-reason ba-mono">매출(추정) {c.revenue.toLocaleString()}원 · 전환 {c.conversions.toLocaleString()}건</div>
                  </div>
                ))}
                <div className="ba-clv-grid" style={{ marginTop: 12 }}>
                  <div className="ba-clv-metric">
                    <div className="ba-clv-metric-label">즉시 ROAS (첫 구매 매출 기준)</div>
                    <div className="ba-clv-metric-value">{results.roas.blended.immediateROAS}x</div>
                  </div>
                  <div className="ba-clv-metric">
                    <div className="ba-clv-metric-label">LTV 기준 ROAS (재구매 가치 반영)</div>
                    <div className="ba-clv-metric-value">{results.roas.blended.ltvROAS}x</div>
                  </div>
                </div>
                <div className="ba-trigger" style={{ borderColor: "var(--dim)", color: "var(--dim)" }}>
                  AI 추정 · 업계 평균 벤치마크 기반, 실측 아님. 실제 캠페인 성과와 다를 수 있습니다.
                </div>
              </div>
            )}

            {stage === ENGINES.length && (
              <div className="ba-result" style={{ marginTop: 16 }} id="section-diagnosis">
                <div className="ba-node-label" style={{ marginBottom: 4 }}>무료 사전진단</div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
                  BA KOREA가 실제로 판매 중인 컨설팅 상품과 동일한 깊이의 예비진단입니다. 확정 판단이 아닌 힌트 수준이며, 각 결과 하단에 정식 상담 링크가 있습니다.
                </div>
                <div className="ba-output-grid">
                  {OUTPUT_DEFS.filter((d) => d.group === "diagnosis").map((def) => {
                    const Icon = def.icon;
                    const state = outputs[def.id];
                    return (
                      <button
                        key={def.id}
                        className="ba-output-btn"
                        type="button"
                        onClick={() => generateOutput(def)}
                        disabled={state?.loading}
                      >
                        {state?.loading ? <Loader2 size={16} className="ba-spin" /> : <Icon size={16} />}
                        {def.label}
                      </button>
                    );
                  })}
                </div>

                <div className="ba-node-label" style={{ marginTop: 20, marginBottom: 4 }} id="section-creative">실행 크리에이티브</div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
                  캠페인을 바로 실행할 때 쓸 수 있는 산출물입니다.
                </div>
                <div className="ba-output-grid">
                  {OUTPUT_DEFS.filter((d) => d.group === "creative").map((def) => {
                    const Icon = def.icon;
                    const state = outputs[def.id];
                    return (
                      <button
                        key={def.id}
                        className="ba-output-btn"
                        type="button"
                        onClick={() => generateOutput(def)}
                        disabled={state?.loading}
                      >
                        {state?.loading ? <Loader2 size={16} className="ba-spin" /> : <Icon size={16} />}
                        {def.label}
                      </button>
                    );
                  })}
                </div>

                {OUTPUT_DEFS.map((def) => {
                  const state = outputs[def.id];
                  if (!state) return null;
                  return (
                    <div className="ba-output-panel" key={def.id}>
                      <div className="ba-output-panel-head">
                        <span>{def.label}</span>
                        {state.text && (
                          <button className="ba-copy-btn" type="button" onClick={() => copyOutput(def.id, state.text!)}>
                            {copiedId === def.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === def.id ? "복사됨" : "복사"}
                          </button>
                        )}
                      </div>
                      {state.loading && <div className="ba-history-empty">전문가 관점으로 생성 중...</div>}
                      {state.error && (
                        <div className="ba-error">
                          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>{state.error}</span>
                        </div>
                      )}
                      {state.truncated && state.text && (
                        <div className="ba-error" style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>
                          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>응답이 길이 제한으로 일부 잘렸습니다. 아래는 잘리기 전까지 생성된 내용입니다 — 필요하면 다시 생성해 보세요.</span>
                        </div>
                      )}
                      {state.text && <div className="ba-md">{renderLite(state.text)}</div>}
                      {state.text && def.cta && (
                        <a className="ba-cta-banner" href={def.cta.url} target="_blank" rel="noopener noreferrer">
                          <span>이 진단은 참고용 예비 진단입니다. 실제 컨설팅이 필요하시면 →</span>
                          <b>{def.cta.label}</b>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {stage === ENGINES.length && (
              <>
                <div className="ba-state-toggle" onClick={() => setShowState((s) => !s)} id="section-state">
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
