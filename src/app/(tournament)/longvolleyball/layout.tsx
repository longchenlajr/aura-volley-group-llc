import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Long Volleyball",
    template: "%s | Long Volleyball",
  },
};

export default function LongVolleyballLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
