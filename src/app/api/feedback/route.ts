import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function normalizePerformance(actual_roas?: number, actual_cvr?: number): number {
  // ROAS 3배를 "우수(1.0)" 기준점으로 삼아 0~1로 정규화. ROAS가 없으면 CVR 5%를 기준으로 대체.
  if (typeof actual_roas === "number") return Math.max(0, Math.min(1, actual_roas / 3));
  if (typeof actual_cvr === "number") return Math.max(0, Math.min(1, actual_cvr / 0.05));
  return 0.5;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const campaignId = req.nextUrl.searchParams.get("campaign_id");

    let feedbackQuery = supabase.from("campaign_feedback").select("*").order("recorded_at", { ascending: false }).limit(20);
    if (campaignId) feedbackQuery = feedbackQuery.eq("campaign_id", campaignId);
    const { data: feedback, error: fErr } = await feedbackQuery;
    if (fErr) throw fErr;

    const { data: sourceScores, error: sErr } = await supabase
      .from("source_effectiveness")
      .select("*")
      .order("score", { ascending: false });
    if (sErr) throw sErr;

    return NextResponse.json({ feedback, sourceScores });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, channel, actual_ctr, actual_cvr, actual_roas, notes } = await req.json();
    if (!campaign_id) return NextResponse.json({ error: "campaign_id가 필요합니다." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: feedbackRow, error: insErr } = await supabase
      .from("campaign_feedback")
      .insert({ campaign_id, channel, actual_ctr, actual_cvr, actual_roas, notes })
      .select()
      .single();
    if (insErr) throw insErr;

    // 이 캠페인이 참고했던 시장 데이터 소스를 찾아 효과성 점수를 갱신 (피드백 루프)
    const { data: campaign } = await supabase.from("campaigns").select("results").eq("id", campaign_id).maybeSingle();
    const ragSources: string[] = campaign?.results?.strategy?.ragSources || [];
    const perf = normalizePerformance(actual_roas, actual_cvr);

    for (const source of ragSources) {
      const { data: existing } = await supabase.from("source_effectiveness").select("*").eq("source", source).maybeSingle();
      const prevScore = existing ? Number(existing.score) : 0.5;
      const prevSamples = existing ? Number(existing.sample_size) : 0;
      const newScore = prevScore * 0.7 + perf * 0.3; // 지수이동평균으로 점진 갱신
      await supabase.from("source_effectiveness").upsert({
        source,
        score: newScore,
        sample_size: prevSamples + 1,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ feedback: feedbackRow, updatedSources: ragSources });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}
