import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function normalizePerformance(actual_roas?: number, actual_cvr?: number): number {
  // ROAS 3배를 "우수(1.0)" 기준점으로 삼아 0~1로 정규화. ROAS가 없으면 CVR 5%를 기준으로 대체.
  if (typeof actual_roas === "number") return Math.max(0, Math.min(1, actual_roas / 3));
  if (typeof actual_cvr === "number") return Math.max(0, Math.min(1, actual_cvr / 0.05));
  return 0.5;
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
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

    const { data: campaign } = await supabase.from("campaigns").select("results").eq("id", campaign_id).maybeSingle();
    const perf = normalizePerformance(actual_roas, actual_cvr);

    // 1) 이 캠페인이 참고했던 시장 데이터 소스의 신뢰도 점수 갱신
    const ragSources: string[] = campaign?.results?.strategy?.ragSources || [];
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

    // 2) MMM 모델 자동 재학습: 이 채널에 대해 모델이 "예측한 실현 효과지수"와
    //    실제 성과를 비교해 channel_calibration(보정 배수)을 갱신한다.
    //    다음 캠페인부터 이 배수가 Strategy Engine의 Vmax에 곱해져 배분에 반영된다.
    let updatedCalibration: { channel: string; multiplier: number } | null = null;
    if (channel) {
      const strategyChannels = campaign?.results?.strategy?.channels || [];
      const predicted = strategyChannels.find((c: any) => c.name === channel);
      const predictedNorm = predicted && predicted.response > 1 ? predicted.response / 100 : null;

      if (predictedNorm) {
        const ratio = clamp(perf / predictedNorm, 0.2, 5);
        const { data: existingCal } = await supabase.from("channel_calibration").select("*").eq("channel", channel).maybeSingle();
        const prevMultiplier = existingCal ? Number(existingCal.multiplier) : 1.0;
        const prevSamples = existingCal ? Number(existingCal.sample_size) : 0;
        const newMultiplier = clamp(prevMultiplier * 0.7 + ratio * 0.3, 0.3, 3.0);
        await supabase.from("channel_calibration").upsert({
          channel,
          multiplier: newMultiplier,
          sample_size: prevSamples + 1,
          updated_at: new Date().toISOString(),
        });
        updatedCalibration = { channel, multiplier: newMultiplier };
      }
    }

    return NextResponse.json({ feedback: feedbackRow, updatedSources: ragSources, updatedCalibration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}
