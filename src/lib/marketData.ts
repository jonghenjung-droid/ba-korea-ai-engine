// 실시간 시장 데이터 루프의 공용 헬퍼
// 1. 수집(SerpAPI: Google Trends/News) 2. 정제(간단 정규화) 3. 임베딩(Voyage AI, pgvector 저장용)

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null; // 임베딩 키가 없으면 벡터 없이 텍스트만 저장 (RAG 유사도 검색은 건너뜀)
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text.slice(0, 8000)],
      model: "voyage-3-lite", // 512차원 - DB 스키마(vector(512))와 반드시 일치해야 함
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.embedding || null;
}

export type TrendSignal = { keyword: string; metric: string; value: number; source: string; raw: any };
export type NewsDoc = { keyword: string; title: string; content: string; source: string };

// Google Trends 관심도 추이 (SerpAPI 경유) - 최근 상대 검색량(0~100)
export async function fetchTrendSignal(keyword: string): Promise<TrendSignal | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;
  const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&data_type=TIMESERIES&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const points = data?.interest_over_time?.timeline_data;
  if (!points || points.length === 0) return null;
  const latest = points[points.length - 1];
  const value = Number(latest?.values?.[0]?.extracted_value ?? latest?.values?.[0]?.value ?? 0);
  return { keyword, metric: "search_volume", value, source: "serpapi_trends", raw: latest };
}

// 관련 뉴스 - 원문 스니펫을 market_documents(RAG)용으로 반환
export async function fetchNewsDocs(keyword: string, limit = 5): Promise<NewsDoc[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];
  const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(keyword)}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data?.news_results || []).slice(0, limit);
  return items.map((it: any) => ({
    keyword,
    title: it.title || "",
    content: `${it.title || ""} - ${it.snippet || ""}`.trim(),
    source: "serpapi_news",
  }));
}

// Brand Engine 보조: 브랜드명 일반 검색 스니펫 (SerpAPI, 있으면 사용).
// 인스타그램·네이버플레이스처럼 자바스크립트 렌더링 페이지는 직접 fetch로 못 읽지만,
// 검색엔진이 이미 색인해둔 텍스트(소개글·리뷰 일부)는 이 경로로 가져올 수 있다.
export async function fetchBrandSearchSnippets(query: string, limit = 5): Promise<string[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=ko&gl=kr&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data?.organic_results || []).slice(0, limit);
  return items
    .map((it: any) => `${it.title || ""} - ${it.snippet || ""}`.trim())
    .filter((s: string) => s.length > 3);
}
