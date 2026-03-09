export type Drop = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  story: string;
  featuredProductSlugs: string[];
};

export const drops: Drop[] = [
  {
    id: "drop-001",
    slug: "drop-001",
    name: "Drop 001",
    subtitle: "First statement.",
    story:
      "One shirt hides in plain sight. The other pulls you in. Midnight Sigil is dark on dark — subtle enough to make you lean in and ask what it says. Void Pull is the spiral, the gravity, the thing about this group that people can't quite explain but can't ignore either.",
    featuredProductSlugs: ["midnight-sigil", "void-pull"],
  },
];
