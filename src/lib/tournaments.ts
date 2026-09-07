import data from "@/config/tournaments.json";

export interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  format: "doubles" | "triples" | "quads" | "sixes";
  teamSize: 2 | 3 | 4 | 6;
  registrationOpen: boolean;
  maxTeams?: number;
  collectShirtSize?: boolean;
  /** AwesomeFest format override: games to 21 (2 sets, cap 23) and a single playoff bracket (everyone makes playoffs). */
  awesomefest?: boolean;
  /** Entry fee per player, in integer cents (e.g. 2500 for $25/player). */
  priceCents: number;
  /** Offer optional online pre-payment (PayPal) during registration. Default off. */
  onlinePaymentEnabled?: boolean;
}

const allTournaments: Tournament[] = (data as { tournaments: Tournament[] }).tournaments;
const tournaments: Tournament[] =
  process.env.NODE_ENV === "development"
    ? allTournaments
    : allTournaments.filter((t) => !t.id.startsWith("dev-"));

export function getTournaments(): Tournament[] {
  return tournaments;
}

export function getTournament(id: string): Tournament | null {
  return tournaments.find((t) => t.id === id) ?? null;
}

/**
 * The standard per-player entry fee, in cents, for marketing copy that isn't
 * tied to a specific tournament (e.g. the landing page facts, rules page).
 * Reads from the first doubles-format tournament's `priceCents` (every
 * tournament currently shares the same fee); falls back to the first
 * tournament in config if none is a doubles tournament.
 */
export function getStandardEntryFeeCents(): number {
  const reference = tournaments.find((t) => t.format === "doubles") ?? tournaments[0];
  return reference?.priceCents ?? 0;
}

export function getUpcomingTournaments(): Tournament[] {
  return tournaments.filter((t) => {
    const status = getTournamentStatus(t.date);
    return status === "upcoming" || status === "live";
  });
}

export type TournamentStatus = "upcoming" | "live" | "archive";

export function getTournamentStatus(tournamentDate: string): TournamentStatus {
  try {
    const etFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const tournamentDay = etFormatter.format(new Date(tournamentDate));
    const todayInET = etFormatter.format(new Date());

    if (tournamentDay === todayInET) return "live";
    if (new Date(tournamentDate) > new Date()) return "upcoming";
    return "archive";
  } catch {
    return "archive";
  }
}

export type TournamentWithStatus = Tournament & { status: TournamentStatus };

export function getTournamentsWithStatus(): TournamentWithStatus[] {
  return getTournaments()
    .map((t) => ({ ...t, status: getTournamentStatus(t.date) }))
    .sort((a, b) => {
      const priority = { live: 0, upcoming: 1, archive: 2 };
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      if (a.status === "archive") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}
