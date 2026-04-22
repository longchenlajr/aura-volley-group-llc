import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Long Volleyball",
    template: "%s | Long Volleyball",
  },
  description:
    "Long Volleyball — family-run volleyball tournaments servicing the Lehigh Valley community.",
  openGraph: {
    siteName: "Long Volleyball",
    description:
      "Family-run volleyball tournaments servicing the Lehigh Valley community.",
  },
};

export default function LongVolleyballLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
