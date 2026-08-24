import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Brand Engine 보조: 브랜드 홈페이지 URL을 넣으면 본문 텍스트만 추출해 반환한다.
// Firecrawl 같은 유료 크롤링 API 없이, 단순 fetch + 태그 제거로 구현한 경량 버전이다.
// 자바스크립트로 렌더링되는 SPA 사이트는 원문이 비어있을 수 있다(알려진 한계).
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "http/https URL만 지원합니다." }, { status: 400 });
    }

    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BAKoreaAIGrowthAgent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `페이지를 불러오지 못했습니다 (${res.status})` }, { status: 502 });
    }
    const html = await res.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text.length < 30) {
      return NextResponse.json(
        { error: "페이지에서 텍스트를 추출하지 못했습니다 (자바스크립트 렌더링 사이트일 수 있음)." },
        { status: 200 }
      );
    }

    return NextResponse.json({ text: text.slice(0, 4000) });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "페이지 응답이 너무 느려 시간 초과되었습니다." : e.message || "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
