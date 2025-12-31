export type Player = {
  id: string;
  slug: string;
  name: string;
  role?: string;
  bio?: string;
  socials?: {
    instagram?: string;
    tiktok?: string;
  };
  headshot?: string | null; // path to image when you have it
  featuredProductSlugs?: string[];
};

export const players: Player[] = [
  {
    id: "pl-chenla",
    slug: "chenla",
    name: "Chenla Long, Jr",
    role: "Founder / Pin Hitter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-caleb",
    slug: "caleb",
    name: "Caleb Bauder",
    role: "Pin Hitter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-david",
    slug: "david",
    name: "David Barnes",
    role: "Middle Blocker",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-justin",
    slug: "justin",
    name: "Justin Flor",
    role: "Pin Hitter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-keith",
    slug: "keith",
    name: "Keith Hardaway",
    role: "Middle Blocker",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-kyle",
    slug: "kyle",
    name: "Kyle Whiteman",
    role: "Setter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-owen",
    slug: "owen",
    name: "Owen McFadden",
    role: "Middle Blocker",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-quinn",
    slug: "quinn",
    name: "Quinn Hornberger",
    role: "Pin Hitter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-trey",
    slug: "trey",
    name: 'Donald "Trey" West III',
    role: "Pin Hitter",
    bio: "Aura Volley Group.",
  },
  {
    id: "pl-alberto",
    slug: "alberto",
    name: "Alberto Ramon",
    role: "Libero",
    bio: "Aura Volley Group.",
  },

  {
    id: "pl-lucas",
    slug: "lucas",
    name: "Lucas Adam",
    role: "Libero",
    bio: "Aura Volley Group.",
  },
];
