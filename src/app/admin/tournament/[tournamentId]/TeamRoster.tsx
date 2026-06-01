"use client";

import { Fragment, useState, useMemo } from "react";
import type { Team } from "./types";

interface TeamRosterProps {
  teams: Team[];
  poolsExist: boolean;
  onAddTeam: () => void;
  onEditTeam: (team: Team) => void;
  onWithdrawTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onPatchTeam: (id: string, updates: Record<string, unknown>) => void;
}

function formatRegisteredDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const hasSeed = (t: Team) => t.seed != null && t.seed > 0;
const byCreated = (a: Team, b: Team) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

/**
 * Seed input that holds its own draft text and only commits on blur. This keeps
 * the surrounding list from re-sorting mid-keystroke (typing "12" would briefly
 * be "1" and yank the row away). Commit happens once, when the field loses focus.
 *
 * The committed seed value is used as a `key` at the call site, so this remounts
 * (and re-seeds its draft from the prop) whenever the seed actually changes —
 * no syncing effect needed.
 */
function SeedInput({
  team,
  onCommit,
}: {
  team: Team;
  onCommit: (val: number | null) => void;
}) {
  const [val, setVal] = useState(team.seed != null ? String(team.seed) : "");

  return (
    <input
      type="number"
      className="lv-admin-seed"
      min={1}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const parsed = val ? parseInt(val, 10) : null;
        onCommit(parsed != null && Number.isNaN(parsed) ? null : parsed);
      }}
    />
  );
}

export function TeamRoster({
  teams,
  poolsExist,
  onAddTeam,
  onEditTeam,
  onWithdrawTeam,
  onDeleteTeam,
  onPatchTeam,
}: TeamRosterProps) {
  const [expanded, setExpanded] = useState(!poolsExist);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const activeTeams = teams.filter((t) => !t.withdrawn_at);
  const withdrawnTeams = teams.filter((t) => !!t.withdrawn_at);
  const checkedInCount = activeTeams.filter((t) => t.checked_in).length;

  // Seeded teams first (ascending by seed), then unseeded by registration time.
  const seededTeams = useMemo(
    () => activeTeams.filter(hasSeed).sort((a, b) => a.seed! - b.seed! || byCreated(a, b)),
    [activeTeams],
  );
  const unseededTeams = useMemo(
    () => activeTeams.filter((t) => !hasSeed(t)).sort(byCreated),
    [activeTeams],
  );
  const sortedWithdrawn = useMemo(
    () => [...withdrawnTeams].sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || byCreated(a, b)),
    [withdrawnTeams],
  );

  // Seed sanity checks across active teams.
  const { duplicateSeeds, outOfRangeIds, gaps } = useMemo(() => {
    const counts = new Map<number, string[]>();
    for (const t of seededTeams) {
      if (!counts.has(t.seed!)) counts.set(t.seed!, []);
      counts.get(t.seed!)!.push(t.team_name);
    }
    const duplicateSeeds = new Map<number, string[]>();
    for (const [seed, names] of counts) if (names.length > 1) duplicateSeeds.set(seed, names);

    const outOfRangeIds = new Set(
      seededTeams.filter((t) => t.seed! > activeTeams.length).map((t) => t.id),
    );

    const present = new Set(seededTeams.map((t) => t.seed!));
    const maxSeed = seededTeams.reduce((m, t) => Math.max(m, t.seed!), 0);
    const gaps: number[] = [];
    for (let s = 1; s <= maxSeed; s++) if (!present.has(s)) gaps.push(s);

    return { duplicateSeeds, outOfRangeIds, gaps };
  }, [seededTeams, activeTeams]);

  function commitSeed(team: Team, val: number | null) {
    if (team.seed === val) return;
    onPatchTeam(team.id, { seed: val });
    setHighlightId(team.id);
    setTimeout(() => setHighlightId((cur) => (cur === team.id ? null : cur)), 1200);
  }

  function toggleTeamExpand(teamId: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  const hasWarnings = duplicateSeeds.size > 0 || outOfRangeIds.size > 0 || gaps.length > 0;

  // Build the ordered group list once so table + cards stay in sync.
  const groups: Array<{ key: string; label: string; teams: Team[] }> = [];
  if (seededTeams.length > 0) groups.push({ key: "seeded", label: "Seeded", teams: seededTeams });
  if (unseededTeams.length > 0) groups.push({ key: "unseeded", label: "Unseeded", teams: unseededTeams });
  if (showWithdrawn && sortedWithdrawn.length > 0)
    groups.push({ key: "withdrawn", label: "Withdrawn", teams: sortedWithdrawn });

  return (
    <div className="lv-roster-section">
      {/* Header — always visible */}
      <button className="lv-roster-header" onClick={() => setExpanded(!expanded)}>
        <span className="lv-roster-title">
          Registered teams &middot; {activeTeams.length}
        </span>
        {!expanded && (
          <span className="lv-roster-summary">
            {seededTeams.length} seeded &middot; {checkedInCount} checked in
            {withdrawnTeams.length > 0 && ` · ${withdrawnTeams.length} withdrawn`}
          </span>
        )}
        <svg
          className={`lv-admin-expand-icon ${expanded ? "open" : ""}`}
          width="14" height="14" viewBox="0 0 20 20"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {/* Add team button — next to header area */}
      {expanded && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="lv-btn lv-btn-secondary lv-roster-add-btn" onClick={onAddTeam} style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
            Add team
          </button>
        </div>
      )}

      {expanded && (
        <div className="lv-roster-body">
          {/* Seed warnings */}
          {hasWarnings && (
            <div className="lv-roster-seed-warning">
              {Array.from(duplicateSeeds.entries()).map(([seed, names]) => (
                <div key={`dup-${seed}`}>
                  <strong>Duplicate seed #{seed}:</strong> {names.join(", ")}
                </div>
              ))}
              {outOfRangeIds.size > 0 && (
                <div>
                  <strong>Out of range:</strong>{" "}
                  {seededTeams
                    .filter((t) => outOfRangeIds.has(t.id))
                    .map((t) => `${t.team_name} (#${t.seed})`)
                    .join(", ")}{" "}
                  &mdash; only {activeTeams.length} team{activeTeams.length === 1 ? "" : "s"} registered.
                </div>
              )}
              {gaps.length > 0 && (
                <div>
                  <strong>Missing seed{gaps.length > 1 ? "s" : ""}:</strong> {gaps.map((g) => `#${g}`).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Desktop table */}
          <div className="lv-roster-table-wrap">
            <table className="lv-roster-table">
              <thead>
                <tr>
                  <th>Team name</th>
                  <th>Captain</th>
                  <th>Players</th>
                  <th>Seed</th>
                  <th>Checked in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="lv-roster-group-row">
                      <td colSpan={6}>{group.label} &middot; {group.teams.length}</td>
                    </tr>
                    {group.teams.map((t) => {
                      const captain = t.players.find((p) => p.is_captain);
                      const teammates = t.players.filter((p) => !p.is_captain);
                      return (
                        <TeamTableRows
                          key={t.id}
                          team={t}
                          captain={captain}
                          teammates={teammates}
                          isWithdrawn={!!t.withdrawn_at}
                          isTeamExpanded={expandedTeams.has(t.id)}
                          isDuplicate={t.seed != null && duplicateSeeds.has(t.seed)}
                          isOutOfRange={outOfRangeIds.has(t.id)}
                          isHighlighted={highlightId === t.id}
                          onToggleExpand={() => toggleTeamExpand(t.id)}
                          poolsExist={poolsExist}
                          onEditTeam={onEditTeam}
                          onWithdrawTeam={onWithdrawTeam}
                          onDeleteTeam={onDeleteTeam}
                          onCommitSeed={(val) => commitSeed(t, val)}
                          onPatchTeam={onPatchTeam}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lv-roster-cards">
            {groups.map((group) => (
              <Fragment key={group.key}>
                <div className="lv-roster-group-header">{group.label} &middot; {group.teams.length}</div>
                {group.teams.map((t) => {
                  const captain = t.players.find((p) => p.is_captain);
                  const teammates = t.players.filter((p) => !p.is_captain);
                  const isWithdrawn = !!t.withdrawn_at;
                  const isTeamExpanded = expandedTeams.has(t.id);
                  const isDuplicate = t.seed != null && duplicateSeeds.has(t.seed);
                  const isOutOfRange = outOfRangeIds.has(t.id);
                  const cardCls = [
                    "lv-roster-card",
                    (isDuplicate || isOutOfRange) ? "lv-roster-row-flag" : "",
                    highlightId === t.id ? "lv-roster-row-highlight" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <div key={t.id} className={cardCls} style={isWithdrawn ? { opacity: 0.5 } : undefined}>
                      <div className="lv-roster-card-top" onClick={() => toggleTeamExpand(t.id)}>
                        <div style={{ flex: 1 }}>
                          <div className="lv-roster-card-name">
                            {t.team_name}
                            {isWithdrawn && <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontWeight: 400, fontStyle: "italic" }}> (withdrawn)</span>}
                          </div>
                          <div className="lv-roster-card-players">
                            <div className="lv-roster-player-line">
                              <span className="lv-roster-player-name">
                                {captain?.name ?? "—"} <span className="lv-roster-captain-badge">Capt</span>
                              </span>
                              {isTeamExpanded && (
                                <span className="lv-roster-player-contact">
                                  {captain?.email && <span>{captain.email}</span>}
                                  {(captain?.phone || t.contact_phone) && <span>{captain?.phone || t.contact_phone}</span>}
                                </span>
                              )}
                            </div>
                            {teammates.map((p) => (
                              <div key={p.id} className="lv-roster-player-line">
                                <span className="lv-roster-player-name">{p.name}</span>
                                {isTeamExpanded && (p.email || p.phone) && (
                                  <span className="lv-roster-player-contact">
                                    {p.email && <span>{p.email}</span>}
                                    {p.phone && <span>{p.phone}</span>}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {isTeamExpanded && (
                            <div className="lv-roster-registered-at">
                              Registered {formatRegisteredDate(t.created_at)}
                            </div>
                          )}
                        </div>
                        <svg
                          className={`lv-admin-expand-icon ${isTeamExpanded ? "open" : ""}`}
                          width="12" height="12" viewBox="0 0 20 20"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: 0, marginLeft: 8, color: "var(--lv-ink-muted)" }}
                        >
                          <path d="M6 8l4 4 4-4" />
                        </svg>
                      </div>

                      {!isWithdrawn && (
                        <div className="lv-roster-card-row">
                          <div className="lv-admin-card-row">
                            <span className="lv-admin-card-label">Seed</span>
                            <SeedInput key={t.seed ?? "none"} team={t} onCommit={(val) => commitSeed(t, val)} />
                          </div>
                          <div className="lv-admin-card-row">
                            <span className="lv-admin-card-label">Checked in</span>
                            <button
                              className={`lv-toggle ${t.checked_in ? "on" : ""}`}
                              onClick={() => onPatchTeam(t.id, { checked_in: !t.checked_in })}
                              aria-label={t.checked_in ? "Checked in" : "Not checked in"}
                            />
                          </div>
                        </div>
                      )}
                      {!isWithdrawn && (
                        <div className="lv-roster-card-actions">
                          <button
                            className="lv-admin-action-btn"
                            onClick={() => onEditTeam(t)}
                            aria-label="Edit team"
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13.586 3.586a2 2 0 012.828 2.828l-8.793 8.793L4 16l.793-3.621 8.793-8.793z" />
                            </svg>
                          </button>
                          <button
                            className="lv-admin-action-btn lv-admin-action-btn-danger"
                            onClick={() => poolsExist ? onWithdrawTeam(t) : onDeleteTeam(t)}
                            aria-label={poolsExist ? "Withdraw team" : "Remove team"}
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Withdrawn teams toggle */}
          {withdrawnTeams.length > 0 && (
            <button
              className="lv-withdrawn-toggle"
              onClick={() => setShowWithdrawn(!showWithdrawn)}
            >
              {showWithdrawn
                ? `Hide ${withdrawnTeams.length} withdrawn team${withdrawnTeams.length > 1 ? "s" : ""}`
                : `Show ${withdrawnTeams.length} withdrawn team${withdrawnTeams.length > 1 ? "s" : ""}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Desktop table row + expandable detail ── */

function TeamTableRows({
  team: t,
  captain,
  teammates,
  isWithdrawn,
  isTeamExpanded,
  isDuplicate,
  isOutOfRange,
  isHighlighted,
  onToggleExpand,
  poolsExist,
  onEditTeam,
  onWithdrawTeam,
  onDeleteTeam,
  onCommitSeed,
  onPatchTeam,
}: {
  team: Team;
  captain: Team["players"][number] | undefined;
  teammates: Team["players"];
  isWithdrawn: boolean;
  isTeamExpanded: boolean;
  isDuplicate: boolean;
  isOutOfRange: boolean;
  isHighlighted: boolean;
  onToggleExpand: () => void;
  poolsExist: boolean;
  onEditTeam: (team: Team) => void;
  onWithdrawTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onCommitSeed: (val: number | null) => void;
  onPatchTeam: (id: string, updates: Record<string, unknown>) => void;
}) {
  const rowCls = [
    isTeamExpanded ? "lv-roster-row-expanded" : "",
    (isDuplicate || isOutOfRange) ? "lv-roster-row-flag" : "",
    isHighlighted ? "lv-roster-row-highlight" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <tr
        style={{ ...(isWithdrawn ? { opacity: 0.5 } : undefined), cursor: "pointer" }}
        onClick={onToggleExpand}
        className={rowCls}
      >
        <td className="lv-admin-team-name">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg
              className={`lv-admin-expand-icon ${isTeamExpanded ? "open" : ""}`}
              width="12" height="12" viewBox="0 0 20 20"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0, color: "var(--lv-ink-muted)" }}
            >
              <path d="M6 8l4 4 4-4" />
            </svg>
            {t.team_name}
            {isWithdrawn && (
              <span style={{ fontWeight: 400, fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontStyle: "italic" }}>
                (withdrawn)
              </span>
            )}
          </div>
        </td>
        <td>
          <div className="lv-roster-player-line">
            <span className="lv-roster-player-name">{captain?.name ?? "—"} <span className="lv-roster-captain-badge">Capt</span></span>
            {isTeamExpanded && (
              <span className="lv-roster-player-contact">
                {captain?.email && <span>{captain.email}</span>}
                {(captain?.phone || t.contact_phone) && <span>{captain?.phone || t.contact_phone}</span>}
              </span>
            )}
          </div>
        </td>
        <td>
          {teammates.length > 0 ? (
            <div className="lv-roster-players-cell">
              {teammates.map((p) => (
                <div key={p.id} className="lv-roster-player-line">
                  <span className="lv-roster-player-name">{p.name}</span>
                  {isTeamExpanded && (p.email || p.phone) && (
                    <span className="lv-roster-player-contact">
                      {p.email && <span>{p.email}</span>}
                      {p.phone && <span>{p.phone}</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : "—"}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {isWithdrawn ? (
            <span style={{ color: "var(--lv-ink-muted)" }}>{t.seed ?? "—"}</span>
          ) : (
            <SeedInput key={t.seed ?? "none"} team={t} onCommit={onCommitSeed} />
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {isWithdrawn ? (
            <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)" }}>—</span>
          ) : (
            <button
              className={`lv-toggle ${t.checked_in ? "on" : ""}`}
              onClick={() => onPatchTeam(t.id, { checked_in: !t.checked_in })}
              aria-label={t.checked_in ? "Checked in" : "Not checked in"}
            />
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {!isWithdrawn && (
            <div style={{ display: "flex", gap: 2 }}>
              <button
                className="lv-admin-action-btn"
                onClick={() => onEditTeam(t)}
                aria-label="Edit team"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.586 3.586a2 2 0 012.828 2.828l-8.793 8.793L4 16l.793-3.621 8.793-8.793z" />
                </svg>
              </button>
              <button
                className="lv-admin-action-btn lv-admin-action-btn-danger"
                onClick={() => {
                  if (poolsExist) onWithdrawTeam(t);
                  else onDeleteTeam(t);
                }}
                aria-label={poolsExist ? "Withdraw team" : "Remove team"}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                </svg>
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded registered-at row */}
      {isTeamExpanded && (
        <tr className="lv-roster-detail-row">
          <td colSpan={6}>
            <div className="lv-roster-registered-at">
              Registered {formatRegisteredDate(t.created_at)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
