import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tracked_keywords")
      .select("*")
      .order("added_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ keywords: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tracked_keywords")
      .upsert({ keyword: keyword.trim() })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ keyword: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "추가 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const keyword = req.nextUrl.searchParams.get("keyword");
    if (!keyword) return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("tracked_keywords").delete().eq("keyword", keyword);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "삭제 실패" }, { status: 500 });
  }
}
