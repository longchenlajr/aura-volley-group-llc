export type EventStatus = "upcoming" | "completed";

export type AuraEvent = {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
};

/** Derive status from event date vs. today */
export function getEventStatus(evt: AuraEvent): EventStatus {
  const eventDate = new Date(evt.date + "T23:59:59");
  return eventDate >= new Date() ? "upcoming" : "completed";
}

export const events: AuraEvent[] = [
  // ── Aura Practice ──
  {
    id: "evt-practice-0227",
    name: "Aura Practice",
    date: "2026-02-27",
    location: "Executive Education Field House — Allentown, PA",
    description: "Weekly team session.",
  },
  {
    id: "evt-practice-0306",
    name: "Aura Practice",
    date: "2026-03-06",
    location: "Executive Education Field House — Allentown, PA",
    description: "Weekly team session.",
  },
  {
    id: "evt-practice-0313",
    name: "Aura Practice",
    date: "2026-03-13",
    location: "Executive Education Field House — Allentown, PA",
    description: "Weekly team session.",
  },
  {
    id: "evt-practice-0320",
    name: "Aura Practice",
    date: "2026-03-20",
    location: "Executive Education Field House — Allentown, PA",
    description: "Weekly team session.",
  },
  {
    id: "evt-practice-0327",
    name: "Aura Practice",
    date: "2026-03-27",
    location: "Executive Education Field House — Allentown, PA",
    description: "Weekly team session.",
  },

  // ── Tournaments & Matches ──
  {
    id: "evt-umbc-oc-0321",
    name: "UMBC x OC Men's 6s",
    date: "2026-03-21",
    location: "UMBC RAC — Baltimore, MD",
    description:
      "Competitive men's sixes tournament. Full-rotation indoor play against club and collegiate programs.",
  },
  {
    id: "evt-nyc-vba-0412",
    name: "NYC VBA Highline — Spike The City",
    date: "2026-04-12",
    location: "Borough of Manhattan Community College — New York, NY",
    description:
      "Urban volleyball showcase hosted by NYC VBA. High-energy indoor tournament in the heart of Manhattan.",
  },
  {
    id: "evt-umbc-oc-0426",
    name: "UMBC x OC Men's 6s",
    date: "2026-04-26",
    location: "UMBC RAC — Baltimore, MD",
    description:
      "Return trip to Baltimore for the second round of the UMBC x OC men's sixes series.",
  },

  // ── ECV Outdoor Tournament Series ──
  {
    id: "evt-ecv-mayfest",
    name: "East Coast Volleyball — MayFest",
    date: "2026-05-16",
    location: "Loan Lane Park — Allentown, PA",
    description:
      "Outdoor grass tournament kicking off the ECV summer series. Doubles and quads divisions.",
  },
  {
    id: "evt-ecv-horshamday",
    name: "East Coast Volleyball — HorshamDay",
    date: "2026-06-06",
    location: "Carpenter Park — Horsham, PA",
    description:
      "Grass doubles and quads tournament at Carpenter Park. Part of the ECV outdoor circuit.",
  },
  {
    id: "evt-ecv-keystonefrenzy",
    name: "East Coast Volleyball — Keystone Frenzy",
    date: "2026-06-13",
    location: "Cousler Park — York, PA",
    description:
      "Mid-June grass tournament in York. Doubles and quads brackets under the ECV banner.",
  },
  {
    id: "evt-ecv-prerumble",
    name: "East Coast Volleyball — PreRumble",
    date: "2026-06-20",
    location: "Cousler Park — York, PA",
    description:
      "Outdoor warm-up event leading into the summer peak. Grass doubles and quads at Cousler Park.",
  },
  {
    id: "evt-ecv-playersopen",
    name: "East Coast Volleyball — Players Open",
    date: "2026-07-11",
    location: "Carpenter Park — Horsham, PA",
    description:
      "Open-entry grass tournament at Carpenter Park. Doubles and quads for all levels.",
  },
  {
    id: "evt-ecv-sportsfest",
    name: "East Coast Volleyball — SportsFest",
    date: "2026-07-18",
    location: "Grange Park — Allentown, PA",
    description:
      "Midsummer grass festival tournament. Doubles and quads divisions in the Lehigh Valley.",
  },
  {
    id: "evt-ecv-theclassic",
    name: "East Coast Volleyball — The Classic",
    date: "2026-08-08",
    location: "Carpenter Park — Horsham, PA",
    description:
      "Flagship ECV outdoor event. Competitive grass doubles and quads at Carpenter Park.",
  },
  {
    id: "evt-ecv-vbbones",
    name: "East Coast Volleyball — VBbones",
    date: "2026-08-15",
    location: "Cousler Park — York, PA",
    description:
      "Late-summer grass tournament in York. Doubles and quads brackets on the ECV circuit.",
  },
  {
    id: "evt-ecv-phillybrawl",
    name: "East Coast Volleyball — PhillyBrawl",
    date: "2026-08-22",
    location: "Pennypack on the DE — Philadelphia, PA",
    description:
      "Outdoor grass tournament in Philly. Doubles and quads divisions with an end-of-summer energy.",
  },
  {
    id: "evt-ecv-spike4mike",
    name: "East Coast Volleyball — Spike4Mike",
    date: "2026-08-29",
    location: "Johnstontown Park — Downingtown, PA",
    description:
      "Charity grass tournament in Downingtown. Doubles and quads — compete for a cause.",
  },
  {
    id: "evt-ecv-labordayvolley",
    name: "East Coast Volleyball — LaborDayVolley",
    date: "2026-09-05",
    location: "Centre Square Park — Blue Bell, PA",
    description:
      "Season-closing grass tournament over Labor Day weekend. Doubles and quads to send off summer.",
  },
];
