"use client";

interface Props {
  matchId: string;
  matchType: "pool" | "bracket";
  workTeamName: string;
  status: string;
  hasWorkTeam: boolean;
  onOpenModal: (matchId: string, matchType: "pool" | "bracket", workTeamName: string) => void;
}

export function SubmitScoresButton({
  matchId,
  matchType,
  workTeamName,
  status,
  hasWorkTeam,
  onOpenModal,
}: Props) {
  // Only show for scheduled/in-progress matches with a work team assigned
  if (!hasWorkTeam || status === "complete") return null;

  return (
    <button
      className="lv-btn lv-btn-secondary lv-btn-submit-scores"
      onClick={(e) => {
        e.stopPropagation();
        onOpenModal(matchId, matchType, workTeamName);
      }}
      aria-label="Submit scores"
    >
      Submit scores
      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4l6 6-6 6" />
      </svg>
    </button>
  );
}
