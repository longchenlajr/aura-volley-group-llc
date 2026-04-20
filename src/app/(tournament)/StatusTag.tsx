import type { TournamentStatus } from "@/lib/tournaments";

interface StatusTagProps {
  status: TournamentStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const className = `lv-status-tag lv-status-tag--${status}`;
  const label = status === "upcoming" ? "Upcoming" : status === "live" ? "Live" : "Archive";

  return <span className={className}>{label}</span>;
}
