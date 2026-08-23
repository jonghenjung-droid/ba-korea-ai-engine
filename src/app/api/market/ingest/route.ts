import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { embedText, fetchNewsDocs, fetchTrendSignal } from "@/lib/marketData";

export const dynamic = "force-dynamic";

// GET: Vercel Cron이 주기적으로 호출 (vercel.json 참고). 수동으로도 호출 가능.
export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!process.env.SERPAPI_KEY) {
    return NextResponse.json(
      { error: "SERPAPI_KEY가 설정되지 않아 실시간 수집을 건너뜁니다.", ingested: 0 },
      { status: 200 }
    );
  }

  const { data: tracked, error: kwErr } = await supabase.from("tracked_keywords").select("keyword");
  if (kwErr) return NextResponse.json({ error: kwErr.message }, { status: 500 });
  if (!tracked || tracked.length === 0) {
    return NextResponse.json({ message: "추적 중인 키워드가 없습니다.", ingested: 0 });
  }

  // 소스별 신뢰도 가중치 조회 (피드백 루프로 갱신된 값. 없으면 기본 0.5로 생성)
  async function getReliability(source: string): Promise<number> {
    const { data } = await supabase.from("source_effectiveness").select("score").eq("source", source).maybeSingle();
    if (data) return Number(data.score);
    await supabase.from("source_effectiveness").upsert({ source, score: 0.5 });
    return 0.5;
  }

  let signalCount = 0;
  let docCount = 0;
  const errors: string[] = [];

  for (const { keyword } of tracked) {
    try {
      // 2단계: 수치형 트렌드 수집 → market_signals (시계열)
      const signal = await fetchTrendSignal(keyword);
      if (signal) {
        const weight = await getReliability(signal.source);
        const { error } = await supabase.from("market_signals").insert({
          source: signal.source,
          keyword: signal.keyword,
          metric: signal.metric,
          value: signal.value,
          reliability_weight: weight,
          raw: signal.raw,
        });
        if (!error) signalCount++;
      }

      // 3단계: 원문 뉴스 수집 → 임베딩 → market_documents (RAG용 벡터 저장)
      const docs = await fetchNewsDocs(keyword, 5);
      for (const doc of docs) {
        const embedding = await embedText(doc.content);
        const weight = await getReliability(doc.source);
        const { error } = await supabase.from("market_documents").insert({
          source: doc.source,
          keyword: doc.keyword,
          title: doc.title,
          content: doc.content,
          embedding: embedding, // VOYAGE_API_KEY 없으면 null (벡터 검색은 건너뜀, 텍스트는 저장됨)
          reliability_weight: weight,
        });
        if (!error) docCount++;
      }
    } catch (e: any) {
      errors.push(`${keyword}: ${e.message}`);
    }
  }

  return NextResponse.json({ signals_ingested: signalCount, documents_ingested: docCount, errors });
}
