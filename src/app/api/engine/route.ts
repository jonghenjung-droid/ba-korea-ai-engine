import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Brand / Customer / Creative / Strategy(서술) 엔진이 이 라우트를 통해 Claude를 호출한다.
// ANTHROPIC_API_KEY는 서버 환경변수로만 존재하며 브라우저로 절대 전달되지 않는다.
export async function POST(req: NextRequest) {
  const { system, prompt, max_tokens: req_max_tokens } = await req.json();

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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(Math.max(Number(req_max_tokens) || 4000, 500), 8000),
        system,
        messages: [{ role: "user", content: prompt }],
      }),
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
    if (data.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "응답이 길이 제한으로 잘렸습니다 (max_tokens 초과). 프롬프트를 줄이거나 max_tokens를 늘려야 합니다." },
        { status: 502 }
      );
    }
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
