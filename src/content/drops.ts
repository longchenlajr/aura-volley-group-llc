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
    id: "drop-spring26",
    slug: "spring26",
    name: "Spring26",
    subtitle: "Foundation set.",
    story:
      "Spring26 is Aura’s foundation set. Pieces that live in your weekly rotation—practice nights, early lifts, long weekends. Simple. Reliable. Made to be worn hard and kept clean.",
    featuredProductSlugs: [
      "spring26-tee-standard",
      "spring26-tee-performance",
      "spring26-hoodie",
      "spring26-sweatpants",
    ],
  },
];
