import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Brand / Customer / Creative / Strategy(서술) 엔진이 이 라우트를 통해 Claude를 호출한다.
// ANTHROPIC_API_KEY는 서버 환경변수로만 존재하며 브라우저로 절대 전달되지 않는다.
export async function POST(req: NextRequest) {
  const { system, prompt, max_tokens: req_max_tokens, enable_web_search } = await req.json();

  if (!prompt) {
    return NextResponse.json({ error: "prompt가 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const body: any = {
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(Math.max(Number(req_max_tokens) || 4000, 500), 8192),
      system,
      messages: [{ role: "user", content: prompt }],
    };
    // Brand Engine 등 근거가 부실할 수 있는 호출에 한해, Claude가 직접 웹을 검색하도록 허용한다.
    // 자바스크립트 렌더링 사이트(fetch-url로 못 읽는 페이지)를 우회하는 가장 확실한 방법이다.
    if (enable_web_search) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Anthropic API 오류 (${res.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = (data.content || []).map((b: any) => b.text || "").join("\n");
    if (!text) {
      return NextResponse.json({ error: "Claude로부터 빈 응답을 받았습니다." }, { status: 502 });
    }
    // stop_reason이 max_tokens여도 에러로 막지 않고, 지금까지 생성된 부분 텍스트를 truncated 플래그와 함께 반환한다.
    // JSON 파싱이 필요한 호출(callClaude)은 클라이언트에서 이 플래그를 보고 실패 처리하지만,
    // 자유 서식 산출물(generateOutput)은 잘린 상태라도 사용자에게 보여주는 편이 낫다.
    return NextResponse.json({ text, truncated: data.stop_reason === "max_tokens" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
