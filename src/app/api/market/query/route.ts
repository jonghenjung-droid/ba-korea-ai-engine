import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { embedText } from "@/lib/marketData";

export const dynamic = "force-dynamic";

// 4단계: RAG - 벡터 유사도로 관련 원문 문서 + 최근 시계열 시그널을 함께 반환.
// Strategy Engine이 Claude를 호출하기 전에 이 컨텍스트를 프롬프트에 덧붙여
// "과거 대비 현재 트렌드 변화"를 감안한 제안을 하도록 만든다.
export async function POST(req: NextRequest) {
  try {
    const { query, keywords } = await req.json();
    if (!query) return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let documents: any[] = [];

    const embedding = await embedText(query);
    if (embedding) {
      const { data, error } = await supabase.rpc("match_market_documents", {
        query_embedding: embedding,
        match_count: 5,
      });
      if (!error) documents = data || [];
    }

    let signalsQuery = supabase
      .from("market_signals")
      .select("*")
      .order("collected_at", { ascending: false })
      .limit(20);
    if (Array.isArray(keywords) && keywords.length > 0) {
      signalsQuery = signalsQuery.in("keyword", keywords);
    }
    const { data: signals } = await signalsQuery;

    const hasData = documents.length > 0 || (signals && signals.length > 0);
    return NextResponse.json({ documents, signals: signals || [], hasData });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "조회 실패" }, { status: 500 });
  }
}
