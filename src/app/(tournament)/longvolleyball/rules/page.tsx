import { SectionDivider } from "../../ornaments";

export default function RulesPage() {
  return (
    <div className="lv-rules-page">
      <div className="lv-container">
        {/* Header */}
        <div className="lv-live-header">
          <p
            className="lv-label"
            style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}
          >
            Rules
          </p>
          <h1 className="lv-h1">Tournament Guidelines</h1>
          <p
            style={{
              color: "var(--lv-ink-muted)",
              fontSize: "0.95rem",
              marginTop: "0.5rem",
            }}
          >
            Standard tournament rules and regulations enforced during
            competition.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider
              className="lv-section-divider"
              style={{ color: "var(--lv-gold)", opacity: 0.5 }}
            />
          </div>
        </div>


      </div>
    </div>
  );
}
