"use client";

interface TeamRow {
  seed: string;
  name: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isBye: boolean;
}

interface Props {
  teamA: TeamRow;
  teamB: TeamRow;
  status: string;
  isChampionMatch: boolean;
  bracketType: "gold" | "silver";
  style?: React.CSSProperties;
  className?: string;
}


export function BracketMatchCard({
  teamA,
  teamB,
  status,
  isChampionMatch,
  bracketType,
  style,
  className,
}: Props) {
  const isBye = status === "bye";
  const isLive = status === "in_progress";
  const isDone = status === "complete";

  const cardCls = [
    "bk-card",
    isBye ? "bk-card--bye" : "",
    isLive ? "bk-card--live" : "",
    isDone ? "bk-card--done" : "",
    isChampionMatch && isDone ? `bk-card--champion-${bracketType}` : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  function renderRow(team: TeamRow, isTop: boolean) {
    if (isBye && team.isBye) {
      return (
        <div className={`bk-row ${isTop ? "bk-row--top" : ""}`}>
          <span className="bk-bye-text">BYE</span>
        </div>
      );
    }

    const rowCls = [
      "bk-row",
      isTop ? "bk-row--top" : "",
      team.isLoser ? "bk-row--loser" : "",
    ].filter(Boolean).join(" ");

    return (
      <div className={rowCls}>
        <span className="bk-seed">{team.seed}</span>
        <span className="bk-name">{team.name || "TBD"}</span>
        {team.score != null && <span className="bk-score">{team.score}</span>}
      </div>
    );
  }

  return (
    <div className={cardCls} style={style}>
      {isLive && <span className="bk-live-dot" />}
      {renderRow(teamA, true)}
      {renderRow(teamB, false)}
    </div>
  );
}
