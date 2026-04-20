import { Inter, Fraunces } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--lv-font-body",
  display: "swap",
});

export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--lv-font-display",
  display: "swap",
});
