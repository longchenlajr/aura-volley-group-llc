export type Player = {
  id: string;
  slug: string;
  name: string;
  nickname?: string;
  role?: string;
  position: string;
  jerseyNumber?: number;
  height?: string;
  college?: string;
  gradYear?: number;
  teamsCoached?: string[];
  teamsPlayed?: string[];
  careerHighlights?: string[];

  favoriteMovie?: string;
  favoriteShoe?: string;
  profession?: string;
  headshot?: string | null; // path to image when you have it
  featuredProductSlugs?: string[];
  socials?: {
    instagram?: string;
    tiktok?: string;
  };
};

export const players: Player[] = [
  {
    id: "pl-chenla",
    slug: "chenla",
    name: "Chenla Long, Jr",
    nickname: "Chen-Bot",
    role: "Founder",
    position: "Outside/Setter",
    jerseyNumber: 24,
    height: "6'1\"",
    college: "Lehigh University",
    gradYear: 2023,
    teamsCoached: [
      "Lehigh University Men's Club Volleyball (2025-)",
      "East Coast Power 16-Columbia (2023-24)",
    ],
    teamsPlayed: [
      "SVC Vipers (2024-25)",
      "Lehigh University Men's Club Volleyball (2019-23)",
      "Club Lehigh 16-18s (2016-19)",
      "William Allen HS (2015-19)",
    ],
    careerHighlights: [
      "All-Tournament Team Selection - 2023 NCVF National Championships",
      "President (2 Year Term) - Lehigh University Men's Club Volleyball",
      "#4 All-Time Kill Record - William Allen HS",
    ],
    favoriteMovie: "Inglorious Basterds",
    favoriteShoe: "Asics Sky Elite FF 3",
    profession: "Software Developer - Victaulic Fire Suppression Technology",
    socials: {
      instagram: "chenla._",
    },
  },
  {
    id: "pl-justin",
    slug: "justin",
    name: "Justin Flor",
    nickname: "Flor",
    position: "Opposite",

    jerseyNumber: 1,
    height: "6'3\"",
    college: "Eastern University",
    gradYear: 2023,

    teamsPlayed: [
      "Shay's Crew",
      "Eastern University Men's Volleyball",
      "ECP Power",
      "Club Lehigh",
      "Quakertown HS",
    ],
    teamsCoached: ["ECP 16s"],

    careerHighlights: [
      "Quakertown HS Captain and Team MVP (2019)",
      "MAC All-Conference Honorable Mention (2022)",
      "Eastern University Men's Volleyball Captain (2022)",
    ],

    favoriteMovie: "Interstellar",
    favoriteShoe: "Nike Hyperattacks",
    profession: "Project Engineer",

    socials: {},
  },
  {
    id: "owen",
    slug: "owen",
    name: "Owen McFadden",

    position: "Middle/Outside/Opposite",
    jerseyNumber: 4,
    height: "6'5",
    college: "King's College",

    teamsPlayed: [
      "SVC Vipers (2024-25)",
      "King's College (2023)",
      "Liberty HS (2019-23)",
    ],
    teamsCoached: [
      "Alvernia University (Men's & Women's)",
      "Velocity LV 17 - National",
    ],

    careerHighlights: [
      "#7 in blocks per set - King's College",
      "Top 10 in hitting percentage - King's College",
    ],

    favoriteMovie: "Top Gun",
    favoriteShoe: "New Balance",
    profession:
      "Assistant Men's and Women's Volleyball Coach - Alvernia University",
    headshot: null,
    socials: {
      instagram: "owen.mcfadden22",
    },
  },
  {
    id: "pl-quinn",
    slug: "quinn",
    name: "Quintin Hornberger",
    position: "Opposite",
    nickname: "The Big Biscuit",

    jerseyNumber: 6,
    height: "6'3",
    college: "Life University",
    gradYear: 2025,

    teamsPlayed: ["Life University (2023-25)"],
    teamsCoached: ["TK Volleyball Academy", "Force Volleyball Club"],

    careerHighlights: [],

    favoriteMovie: "The Nightmare Before Christmas",
    favoriteShoe: "Way of Wade 10 Lows",
    profession: "Sales / Aviation",

    socials: {
      instagram: "qu1nn.5",
    },
  },
  {
    id: "pl-keith",
    slug: "keith",
    name: "Keith Hardaway",
    position: "Middle/Opposite",

    jerseyNumber: 7,
    height: "6'5",
    college: "Penn State University",
    gradYear: 2021,
    teamsCoached: [
      "Emmaus High School",
      "HVA Volleyball Club 14s",
      "Velocity LV 18-2 National",
    ],
    teamsPlayed: ["Liberty HS (2014-16)"],
    careerHighlights: [],
    favoriteMovie: "The Wizard of Oz, Toy Story",
    favoriteShoe: "Mizuno",
    profession: "Registered Nurse",
    socials: {
      instagram: "keithhardawayy",
    },
  },
  {
    id: "pl-david",
    slug: "david",
    name: "David Barnes",
    position: "Middle",

    jerseyNumber: 8,
    height: "6'2",
    college: "Lehigh University",
    gradYear: 2024,

    teamsPlayed: [
      "Lehigh University Men's Club Volleyball (2020-24)",
      "Velocity LV (2018-20)",
      "Freedom HS (2016-20)",
    ],
    teamsCoached: ["Velocity LV 16 National"],

    careerHighlights: ["Won a free throw contest in 3rd grade"],

    favoriteMovie: "Transformers: Revenge of the Fallen",
    favoriteShoe: "Timberlands",
    profession: "Day: Bruce Wayne · Night: Batman",

    socials: {
      instagram: "david.t.barnes",
    },
  },

  {
    id: "pl-edward",
    slug: "edward",
    name: "Edward Popa",
    position: "Middle",

    jerseyNumber: 11,
    height: "6'1",
    college: "BTI",
    gradYear: 2026,
    teamsCoached: ["Catasaqua HS (Girls)", "Velocity LV 17-2 Regional"],
    teamsPlayed: ["Lehigh Carbon Community College Club Volleyball"],
    careerHighlights: [],
    favoriteMovie: "",
    favoriteShoe: "",
    profession: "",
    socials: {
      instagram: "",
    },
  },
  {
    id: "pl-trey",
    slug: "trey",
    name: "Donald West III",
    position: "Outside/Opposite",

    nickname: "Trey",

    jerseyNumber: 13,
    height: "6'2",
    college: "Penn State University",
    gradYear: 2027,

    teamsPlayed: [
      "SVC Vipers (2024-25)",
      "LCCC Men's Volleyball",
      "Southern Lehigh HS",
    ],
    teamsCoached: [
      "Velocity LV 18-1 National (Assistant Coach)",
      "Velocity LV 14U (Head Coach)",
    ],

    careerHighlights: [],

    favoriteMovie: "Maze Runner",
    favoriteShoe: "Giannis Immortality",
    profession: "Links Beverages",

    socials: {
      instagram: "trey_west13",
    },
  },
  {
    id: "pl-alberto",
    slug: "alberto",
    name: "Alberto Ramon",
    position: "Libero",

    nickname: "Bert",

    jerseyNumber: 17,
    height: "5'11",
    college: "Kutztown University",
    gradYear: 2025,

    teamsPlayed: ["SVC Vipers", "Kutztown University", "Wilkes University"],
    teamsCoached: [
      "ECP 15 & 16",
      "Surge 18-1",
      "Velocity LV 17-2 National",
      "Kutztown Area High School",
      "Fleetwood Area High School",
    ],

    careerHighlights: ["Captain at Kutztown University"],

    favoriteMovie: "The Longest Yard",
    favoriteShoe: "Kyries",
    profession: "Digital Sales Manager - ADP",

    socials: {
      instagram: "ecuabert",
    },
  },
  {
    id: "pl-kyle",
    slug: "kyle",
    name: "Kyle Whiteman",
    position: "Setter",

    jerseyNumber: 20,
    height: "5'9",
    college: "Penn State University",
    gradYear: 2022,
    teamsCoached: ["", ""],
    teamsPlayed: [""],
    careerHighlights: [],
    favoriteMovie: "Kyle Whiteman: An underdog story",
    favoriteShoe: "Nike",
    profession: "Teacher & Coach",
    socials: {
      instagram: "kyle_whiteman",
    },
  },
  {
    id: "pl-aldwin",
    slug: "aldwin",
    name: "Aldwin Lora",
    position: "Middle/Outside",

    jerseyNumber: 25,
    height: "6'2",
    college: "Penn State University",
    gradYear: 2023,
    teamsCoached: ["", ""],
    teamsPlayed: ["Dieruff HS (2015-19)"],
    careerHighlights: [],
    favoriteMovie: "All about the Benjamins",
    favoriteShoe: "Kyries",
    profession: "Coach Operator",
    socials: {
      instagram: "CarameloBX",
    },
  },
  {
    id: "pl-caleb",
    slug: "caleb",
    name: "Caleb Bauder",
    position: "Outside",
    nickname: "King Wing / Twisted Nuts / Punisher / Catty League Killa",

    jerseyNumber: 83,
    height: "6'4\"",
    college: "Misericordia University",
    gradYear: 2021,

    teamsPlayed: [
      "SVC Vipers (2024–2025)",
      "Misericordia University Cougars (2017–2021)",
      "Club Lehigh 14–18s (2013-17)",
      "Southern Lehigh HS (2013-17)",
    ],
    teamsCoached: ["Velocity LV 17-1", "Velocity LV 17-3"],

    careerHighlights: [
      "#1 all-time in aces per set - Misericordia University",
      "#1 all-time in aces for a season - Misericordia University",
      "#1 aces in a match (3, 4, and 5 set matches) - Misericordia University",
      "#4 all-time in aces - Misericordia University",
      "#7 all-time reception percentage (min 1,000 attempts – 92.65%) - Misericordia University",
    ],

    favoriteMovie: "Warrior",
    favoriteShoe: "Way of Wade 10s",
    profession: "Security Officer - Perkiomen Valley School District",

    socials: {
      instagram: "bauder83",
    },
  },
  {
    id: "pl-lucas",
    slug: "lucas",
    name: "Lucas Adam",
    position: "Libero",

    jerseyNumber: 1,
    height: "",
    college: "",
    gradYear: 1,
    teamsCoached: ["", ""],
    teamsPlayed: [""],
    careerHighlights: [],
    favoriteMovie: "",
    favoriteShoe: "",
    profession: "",
    socials: {
      instagram: "",
    },
  },
];
