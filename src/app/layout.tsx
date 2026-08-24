import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// next/font로 자체 호스팅 - Google Fonts CSS를 매 요청마다 별도로 받아오던 외부 네트워크 왕복을
// 제거하고, font-display:swap을 자동 적용해 텍스트가 늦게 뜨는 현상(FOIT)을 없앤다.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BA KOREA AI Growth Agent",
  description: "브랜드 캠페인 시뮬레이션 + 사업계획서·제안서·행사 기획 무료 사전진단 — BA KOREA 컨설팅 노하우를 AI로 먼저 체험",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${manrope.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
