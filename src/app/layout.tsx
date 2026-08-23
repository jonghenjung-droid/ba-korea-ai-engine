import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BA KOREA AI Marketing Agent",
  description: "Brand → Customer → Media → Strategy → Creative → Analytics → CLV, 7 Engine Pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
