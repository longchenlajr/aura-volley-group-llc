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
}

const tournaments: Tournament[] = (data as { tournaments: Tournament[] }).tournaments;

export function getTournaments(): Tournament[] {
  return tournaments;
}

export function getTournament(id: string): Tournament | null {
  return tournaments.find((t) => t.id === id) ?? null;
}
