import { NextRequest, NextResponse } from "next/server";
import { fetchBrandSearchSnippets } from "@/lib/marketData";

export const dynamic = "force-dynamic";

// Brand Engine 보조: SERPAPI_KEY가 설정된 경우, 브랜드명으로 일반 검색해 스니펫을 가져온다.
// 인스타그램/네이버플레이스처럼 fetch-url로 못 읽는 페이지의 대안 경로.
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });
    }
    const snippets = await fetchBrandSearchSnippets(query);
    return NextResponse.json({ snippets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
