import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("channel_calibration")
      .select("*")
      .order("channel", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ calibration: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "조회 실패" }, { status: 500 });
  }
}
