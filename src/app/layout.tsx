import type { Metadata } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: {
    default: "Aura Volley Group",
    template: "%s | Aura Volley Group",
  },
  description:
    "Aura Volley Group LLC — home of A-Town Aura volleyball and premium volleyball-inspired apparel.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
