"use client";

interface Props {
  matchId: string;
  matchType: "pool" | "bracket";
  status: string;
  onOpenModal: (matchId: string, matchType: "pool" | "bracket") => void;
}

export function SubmitScoresButton({
  matchId,
  matchType,
  status,
  onOpenModal,
}: Props) {
  // Show for all non-complete matches — any team can submit scores
  if (status === "complete") return null;

  return (
    <button
      className="lv-btn lv-btn-secondary lv-btn-submit-scores"
      onClick={(e) => {
        e.stopPropagation();
        onOpenModal(matchId, matchType);
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
