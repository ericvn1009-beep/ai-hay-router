import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Hay Dashboard",
  description: "Control plane for AI Hay Router",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
