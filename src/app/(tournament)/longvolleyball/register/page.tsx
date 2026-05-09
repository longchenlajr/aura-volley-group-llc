"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Tournament } from "@/lib/tournaments";
import {
  Checkmark,
  ArrowRight,
  SectionDivider,
  CornerFlourish,
  GoldDotSpinner,
} from "../../ornaments";

function formatDisplayLabel(format: string, teamSize: number): string {
  const f = format.toLowerCase();
  if (f === "doubles") return "Doubles (2v2)";
  if (f === "triples") return "Triples (3v3)";
  if (f === "quads") return "Quads (4v4)";
  if (f === "sixes") return "Sixes (6v6)";
  return `${format} (${teamSize}v${teamSize})`;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("tournament") ?? "";

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedId, setSelectedId] = useState(preselected);
  const [teamName, setTeamName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [players, setPlayers] = useState<{ name: string; email?: string; phone?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    tournamentName?: string;
    tournamentDate?: string;
    teamNameResult?: string;
    playerNames?: string[];
    teamSize?: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/register?check=tournaments")
      .then((r) => r.json())
      .then((data) => setTournaments(data.tournaments ?? []))
      .catch((err) => console.error("Failed to load tournaments:", err));
  }, []);

  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setPlayers([]);
      return;
    }
    setPlayers(
      Array.from({ length: selected.teamSize }, () => ({ name: "", email: "", phone: "" })),
    );
  }, [selected]);

  function updatePlayer(idx: number, field: "name" | "email" | "phone", value: string) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  }

  function validatePhone(value: string): boolean {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) {
      setPhoneError("");
      return true;
    }
    setPhoneError("Phone must be a valid 10-digit US number.");
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!validatePhone(contactPhone)) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selected.id,
          teamName,
          contactPhone,
          players,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Registration failed." });
      } else {
        const d = new Date(selected.date);
        setResult({
          ok: true,
          message: "registered",
          tournamentName: selected.name,
          tournamentDate: d.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          teamNameResult: teamName,
          playerNames: players.map((p) => p.name),
          teamSize: selected.teamSize,
        });
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setTeamName("");
    setContactPhone("");
    if (selected) {
      setPlayers(
        Array.from({ length: selected.teamSize }, () => ({ name: "", email: "", phone: "" })),
      );
    }
  }

  // Success — parchment certificate with section divider
  useEffect(() => {
    if (result?.ok) {
      document.title = "Reg. Success | Long Volleyball";
    }
  }, [result?.ok]);

  if (result?.ok) {
    const total = (result.teamSize ?? 2) * 25;
    return (
      <div className="lv-register">
        <div className="lv-success">
          <SectionDivider className="lv-success-divider" />
          <Checkmark className="lv-success-ornament" />
          <h1 className="lv-success-heading">
            {result.teamNameResult} is locked in.
          </h1>
          <p className="lv-success-detail">
            {result.tournamentName} on {result.tournamentDate}
          </p>

          <div className="lv-invoice">
            <div className="lv-invoice-header">
              <span>Player</span>
              <span>Amount</span>
            </div>
            {result.playerNames?.map((name, i) => (
              <div key={i} className="lv-invoice-row">
                <span>{name}</span>
                <span>$25</span>
              </div>
            ))}
            <div className="lv-invoice-total">
              <span>Total due at check-in</span>
              <span>${total}</span>
            </div>
          </div>

          <button
            onClick={reset}
            className="lv-btn lv-btn-ghost"
            style={{ marginTop: "1.5rem" }}
          >
            Register another team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-register">
      {/* Header */}
      <div className="lv-live-header">
        <p className="lv-label" style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}>
          Register
        </p>
        <h1
          className="lv-h1"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
            fontWeight: 900,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          Claim your spot
        </h1>
        <p
          style={{
            fontFamily: "var(--lv-font-body)",
            fontSize: "0.6rem",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "var(--lv-gold)",
            opacity: 0.8,
            marginTop: "0.875rem",
          }}
        >
          Your shot. Claim it.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <SectionDivider
            className="lv-section-divider"
            style={{ color: "var(--lv-gold)", opacity: 0.5 }}
          />
        </div>
      </div>

      {/* Certificate-style card with double border + corner flourishes */}
      <div className="lv-register-card--certificate">
        <CornerFlourish className="lv-reg-flourish lv-reg-flourish-tl" rotate={0} />
        <CornerFlourish className="lv-reg-flourish lv-reg-flourish-tr" rotate={90} />
        <CornerFlourish className="lv-reg-flourish lv-reg-flourish-bl" rotate={270} />
        <CornerFlourish className="lv-reg-flourish lv-reg-flourish-br" rotate={180} />

        <form onSubmit={handleSubmit} className="lv-form">
          {/* Tournament date list — expanded until selection, then collapses */}
          <div className="lv-field">
            <span className="lv-field-label">Tournament Date</span>
            {selected ? (
              <button
                type="button"
                className="lv-date-list-selected"
                onClick={() => setSelectedId("")}
              >
                <span className="lv-date-list-date">
                  {new Date(selected.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="lv-date-list-format">
                  {formatDisplayLabel(selected.format, selected.teamSize)}
                </span>
                <span className="lv-date-list-change">Change</span>
              </button>
            ) : (
              <div className="lv-date-list" role="listbox" aria-label="Select tournament date">
                {[...tournaments]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((t) => {
                    const d = new Date(t.date);
                    const label = d.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const formatLabel = formatDisplayLabel(t.format, t.teamSize);

                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="lv-date-list-item"
                        onClick={() => setSelectedId(t.id)}
                      >
                        <span className="lv-date-list-date">{label}</span>
                        <span className="lv-date-list-format">{formatLabel}</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div className="lv-field">
                <label className="lv-field-label" htmlFor="team-name">
                  Team name
                </label>
                <input
                  id="team-name"
                  className="lv-input"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  placeholder="e.g. Sand Slingers"
                />
              </div>

              {players.map((p, idx) => {
                const isCaptain = idx === 0;
                return (
                  <fieldset key={idx} className="lv-player-group">
                    <legend className="lv-player-legend">
                      {isCaptain ? "Captain" : `Player ${idx + 1}`}
                    </legend>
                    {isCaptain && <span className="lv-captain-badge">Captain</span>}

                    <div className="lv-field">
                      <label className="lv-field-label">Name</label>
                      <input
                        className="lv-input"
                        type="text"
                        value={p.name}
                        onChange={(e) => updatePlayer(idx, "name", e.target.value)}
                        required
                        placeholder="Full name"
                      />
                    </div>
                    <div className="lv-field">
                      <label className="lv-field-label">
                        Email{isCaptain ? "" : " (optional)"}
                      </label>
                      <input
                        className="lv-input"
                        type="email"
                        value={p.email || ""}
                        onChange={(e) => updatePlayer(idx, "email", e.target.value)}
                        required={isCaptain}
                        placeholder={isCaptain ? "Captain's email (required)" : "Player email"}
                      />
                    </div>
                    <div className="lv-field">
                      <label className="lv-field-label">
                        Phone{isCaptain ? "" : " (optional)"}
                      </label>
                      <input
                        className="lv-input"
                        type="tel"
                        value={isCaptain ? contactPhone : (p.phone || "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isCaptain) {
                            setContactPhone(val);
                            setPhoneError("");
                          } else {
                            updatePlayer(idx, "phone", val);
                          }
                        }}
                        onBlur={() => {
                          const val = isCaptain ? contactPhone : (p.phone || "");
                          if (val && isCaptain) validatePhone(val);
                        }}
                        required={isCaptain}
                        placeholder="(555) 123-4567"
                      />
                      {isCaptain && phoneError && <span className="lv-field-error">{phoneError}</span>}
                    </div>
                  </fieldset>
                );
              })}

              {result && !result.ok && (
                <div className="lv-error">{result.message}</div>
              )}

              <button
                type="submit"
                className="lv-btn lv-btn-primary lv-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <GoldDotSpinner className="lv-dot-spinner" />
                    Registering&hellip;
                  </>
                ) : (
                  <>
                    Register
                    <ArrowRight className="lv-btn-arrow" style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
