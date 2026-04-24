"use client";

import { useState, useEffect, useMemo } from "react";
import { getTournamentsWithStatus } from "@/lib/tournaments";
import type { PoolStandings } from "@/lib/standings";
import { daysUntil } from "@/lib/time-format";
import { SectionDivider } from "../../ornaments";
import { DecorativeAsset } from "../../DecorativeAsset";
import { StatusTag } from "../../StatusTag";
import { useLivePolling } from "./useLivePolling";
import { PoolTabs } from "./PoolTabs";
import { TournamentOverview } from "./TournamentOverview";
import { PoolView } from "./PoolView";
import { BracketView } from "./BracketView";

interface StandingsData { pools: PoolStandings[] }
interface PublicPool { pool_label: string; court_number: number; teams: Array<{ team_name: string; seed_in_pool: number }> }
interface PublicMatch {
  match_id: string;
  match_order: number; court_number: number; status: string;
  team_a: string; team_b: string; work_team: string | null; pool_label: string;
  sets: Array<{ set_number: number; team_a_score: number; team_b_score: number }>;
}

interface BracketData {
  bracket_type: string; points_per_set: number;
  slots: Array<{ round_number: number; slot_position: number; team_name: string | null; team_id: string | null; is_bye: boolean }>;
  matches: Array<{
    match_id: string; round_number: number; match_position: number; court_number: number; match_order: number; status: string;
    team_a: string; team_b: string; team_a_id: string | null; team_b_id: string | null;
    score_a: number | null; score_b: number | null; work_team: string | null;
  }>;
}

export default function LivePage() {
  const tournaments = getTournamentsWithStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  const isLive = selected?.status === "live";
  const isUpcoming = selected?.status === "upcoming";
  const isArchive = selected?.status === "archive";

  // Live polling — only create URLs when actually in Live status
  const standingsUrl =
    selected && isLive
      ? `/api/public/standings?tournament=${selected.id}`
      : null;
  const matchesUrl =
    selected && isLive ? `/api/public/matches?tournament=${selected.id}` : null;
  const { data: standingsData, fetching: standingsFetching } =
    useLivePolling<StandingsData>(standingsUrl, 12000, isLive);
  const { data: liveMatchesData } = useLivePolling<{ matches: PublicMatch[] }>(
    matchesUrl,
    12000,
    isLive,
  );

  // Non-polling state
  const [upcomingPools, setUpcomingPools] = useState<PublicPool[] | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<PublicMatch[] | null>(
    null,
  );
  const [archiveStandings, setArchiveStandings] =
    useState<StandingsData | null>(null);
  const [allPublicMatches, setAllPublicMatches] = useState<
    PublicMatch[] | null
  >(null);
  const [bracketData, setBracketData] = useState<BracketData[] | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Fetch data once when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setAllPublicMatches(null);
      setBracketData(null);
      setUpcomingPools(null);
      setUpcomingMatches(null);
      setArchiveStandings(null);
      setActiveTab(null);
      return;
    }

    const tournament = tournaments.find((t) => t.id === selectedId);
    if (!tournament) return;

    // Always fetch matches + brackets
    fetch(`/api/public/matches?tournament=${selectedId}`)
      .then((r) => r.json())
      .then((d) =>
        setAllPublicMatches(d.matches?.length > 0 ? d.matches : null),
      )
      .catch(() => setAllPublicMatches(null));

    fetch(`/api/public/brackets?tournament=${selectedId}`)
      .then((r) => r.json())
      .then((d) => setBracketData(d.brackets?.length > 0 ? d.brackets : null))
      .catch(() => setBracketData(null));

    if (tournament.status === "upcoming") {
      fetch(`/api/public/pools?tournament=${selectedId}`)
        .then((r) => r.json())
        .then((d) => setUpcomingPools(d.pools?.length > 0 ? d.pools : null))
        .catch(() => setUpcomingPools(null));
      fetch(`/api/public/matches?tournament=${selectedId}`)
        .then((r) => r.json())
        .then((d) =>
          setUpcomingMatches(d.matches?.length > 0 ? d.matches : null),
        )
        .catch(() => setUpcomingMatches(null));
    }
    if (tournament.status === "archive") {
      fetch(`/api/public/standings?tournament=${selectedId}`)
        .then((r) => r.json())
        .then((d) => setArchiveStandings(d))
        .catch(() => setArchiveStandings(null));
    }
    setActiveTab(null);
    setHasDefaultedTab(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Default to gold bracket tab when brackets first load
  const [hasDefaultedTab, setHasDefaultedTab] = useState(false);
  useEffect(() => {
    if (bracketData && bracketData.length > 0 && !hasDefaultedTab) {
      setActiveTab("bracket-gold");
      setHasDefaultedTab(true);
    }
  }, [bracketData, hasDefaultedTab]);

  // Use polled matches for live, otherwise use the one-shot fetch
  const effectiveMatches =
    isLive && liveMatchesData?.matches?.length
      ? liveMatchesData.matches
      : allPublicMatches;

  // Derived data
  const activeStandings = isLive
    ? standingsData
    : isArchive
      ? archiveStandings
      : null;

  const poolTabs = useMemo(() => {
    return (activeStandings?.pools ?? []).map((p) => ({
      id: p.pool_id,
      label: p.pool_label,
      courtNumber: p.court_number,
    }));
  }, [activeStandings]);

  const bracketTabs = useMemo(() => {
    if (!bracketData) return [];
    return bracketData.map((b) => ({
      id: `bracket-${b.bracket_type}`,
      label: `${b.bracket_type === "gold" ? "Gold" : "Silver"} Bracket`,
      type: b.bracket_type as "gold" | "silver",
    }));
  }, [bracketData]);

  // Match counts per pool
  const matchesByPool = useMemo(() => {
    const map = new Map<string, { total: number; complete: number }>();
    if (!effectiveMatches) return map;
    for (const m of effectiveMatches) {
      const key = m.pool_label;
      if (!map.has(key)) map.set(key, { total: 0, complete: 0 });
      const entry = map.get(key)!;
      entry.total++;
      if (m.status === "complete") entry.complete++;
    }
    return map;
  }, [effectiveMatches]);

  const poolLabelToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const tab of poolTabs) map.set(tab.label, tab.id);
    return map;
  }, [poolTabs]);

  const matchesByPoolId = useMemo(() => {
    const map = new Map<string, { total: number; complete: number }>();
    for (const [label, info] of matchesByPool) {
      const pid = poolLabelToId.get(label);
      if (pid) map.set(pid, info);
    }
    return map;
  }, [matchesByPool, poolLabelToId]);

  // Selected pool standings + matches
  const selectedPoolStandings = useMemo(() => {
    return (
      (activeStandings?.pools ?? []).find((p) => p.pool_id === activeTab) ??
      null
    );
  }, [activeTab, activeStandings]);

  const selectedPoolMatches = useMemo(() => {
    if (!effectiveMatches || !selectedPoolStandings) return [];
    const label = selectedPoolStandings.pool_label;
    return effectiveMatches
      .filter((m) => m.pool_label === label)
      .map((m) => ({
        match_id: m.match_id,
        match_order: m.match_order,
        court_number: m.court_number,
        status: m.status,
        team_a: m.team_a,
        team_b: m.team_b,
        work_team: m.work_team,
        sets: m.sets ?? [],
      }));
  }, [effectiveMatches, selectedPoolStandings]);

  // Team records for bracket display (seed + W-L from pool play)
  const teamRecords = useMemo(() => {
    const map = new Map<
      string,
      { team_name: string; seed: number; record: string }
    >();
    if (!activeStandings?.pools) return map;
    let overallSeed = 1;
    // Collect all teams by pool rank tiers
    const maxTeamsPerPool = Math.max(
      ...activeStandings.pools.map((p) => p.standings.length),
      0,
    );
    for (let rank = 0; rank < maxTeamsPerPool; rank++) {
      const tier = activeStandings.pools
        .map((p) => p.standings[rank])
        .filter(Boolean)
        .sort((a, b) => {
          if (a.sets_won !== b.sets_won) return b.sets_won - a.sets_won;
          if (a.point_differential !== b.point_differential)
            return b.point_differential - a.point_differential;
          return b.points_for - a.points_for;
        });
      for (const t of tier) {
        map.set(t.team_id, {
          team_name: t.team_name,
          seed: overallSeed++,
          record: `${t.sets_won}-${t.sets_lost}`,
        });
      }
    }
    return map;
  }, [activeStandings]);

  // Render content based on active tab
  function renderTabContent() {
    if (activeTab?.startsWith("bracket-")) {
      const type = activeTab.replace("bracket-", "") as "gold" | "silver";
      const bracket = bracketData?.find((b) => b.bracket_type === type);
      if (!bracket) return null;
      return (
        <BracketView
          bracketType={type}
          pointsPerSet={bracket.points_per_set}
          slots={bracket.slots}
          matches={bracket.matches}
          teamRecords={teamRecords}
        />
      );
    }

    if (activeTab === null) {
      return (
        <TournamentOverview
          standingsData={activeStandings}
          onSelectPool={setActiveTab}
          totalMatchesByPool={matchesByPoolId}
          teamSeeds={teamRecords}
        />
      );
    }

    if (selectedPoolStandings) {
      return (
        <PoolView
          pool={selectedPoolStandings}
          matches={selectedPoolMatches}
          totalMatches={
            matchesByPool.get(selectedPoolStandings.pool_label)?.total ?? 0
          }
          completeMatches={
            matchesByPool.get(selectedPoolStandings.pool_label)?.complete ?? 0
          }
          teamSeeds={teamRecords}
        />
      );
    }

    return null;
  }

  return (
    <div className="lv-live-page">
      <div className="lv-container">
        {/* Header */}
        <div className="lv-live-header">
          <p
            className="lv-label"
            style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}
          >
            Live
          </p>
          <h1 className="lv-h1">Tournament Status</h1>
          <p
            style={{
              color: "var(--lv-ink-muted)",
              fontSize: "0.95rem",
              marginTop: "0.5rem",
            }}
          >
            Standings, scores, and tournament updates in real-time.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider
              className="lv-section-divider"
              style={{ color: "var(--lv-gold)", opacity: 0.5 }}
            />
          </div>
        </div>

        {/* Date selector */}
        <div className="lv-field" style={{ marginBottom: "1.5rem" }}>
          <span className="lv-field-label">Tournament Date</span>
          {selected ? (
            <button
              type="button"
              className="lv-date-list-selected"
              onClick={() => setSelectedId(null)}
            >
              <StatusTag status={selected.status} />
              <span className="lv-date-list-date">
                {new Date(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="lv-date-list-change">Change</span>
            </button>
          ) : (
            <div className="lv-date-list" role="listbox">
              {tournaments.map((t) => {
                const label = new Date(t.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                const fmt =
                  t.format === "doubles"
                    ? "Doubles (2v2)"
                    : t.format === "triples"
                      ? "Triples (3v3)"
                      : `${t.format} (${t.teamSize}v${t.teamSize})`;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="lv-date-list-item"
                    onClick={() => setSelectedId(t.id)}
                  >
                    <StatusTag status={t.status} />
                    <span className="lv-date-list-date">{label}</span>
                    <span className="lv-date-list-format">{fmt}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* === LIVE VIEW === */}
        {selected && isLive && (
          <>
            {(poolTabs.length > 0 || bracketTabs.length > 0) && (
              <PoolTabs
                pools={poolTabs}
                brackets={bracketTabs}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
            )}

            {renderTabContent()}
          </>
        )}

        {/* === UPCOMING VIEW === */}
        {selected && isUpcoming && (
          <div className="lv-live-placeholder">
            <DecorativeAsset
              src="cloud-1.png"
              className="lv-live-placeholder-cloud"
              width={100}
              height={60}
            />
            <SectionDivider className="lv-live-placeholder-divider" />
            <div className="lv-live-countdown">
              {daysUntil(selected.date)} day
              {daysUntil(selected.date) !== 1 ? "s" : ""} until tournament
            </div>

            {upcomingPools ? (
              <>
                <h2 className="lv-live-placeholder-heading">Pools locked in</h2>
                <div className="lv-live-pool-preview">
                  {upcomingPools.map((pool) => (
                    <div key={pool.pool_label} className="lv-live-pool-card">
                      <div className="lv-live-pool-label">
                        Pool {pool.pool_label}
                      </div>
                      <div className="lv-live-pool-court">
                        Court {pool.court_number}
                      </div>
                      {pool.teams.map((t) => (
                        <div key={t.seed_in_pool} className="lv-live-pool-team">
                          {t.team_name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {upcomingMatches && (
                  <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
                    <h3
                      className="lv-live-placeholder-heading"
                      style={{ fontSize: "1rem" }}
                    >
                      Match schedule
                    </h3>
                    {(() => {
                      const byPool = new Map<string, PublicMatch[]>();
                      for (const m of upcomingMatches) {
                        if (!byPool.has(m.pool_label))
                          byPool.set(m.pool_label, []);
                        byPool.get(m.pool_label)!.push(m);
                      }
                      return Array.from(byPool.entries()).map(
                        ([label, pmatches]) => (
                          <div key={label} style={{ marginBottom: "1rem" }}>
                            <div
                              className="lv-live-pool-label"
                              style={{ marginBottom: "0.5rem" }}
                            >
                              Pool {label} · Court {pmatches[0]?.court_number}
                            </div>
                            {pmatches
                              .sort((a, b) => a.match_order - b.match_order)
                              .map((m) => (
                                <div
                                  key={`${m.pool_label}-${m.match_order}`}
                                  className="lv-live-match-row"
                                >
                                  <span className="lv-live-match-num">
                                    {m.match_order}
                                  </span>
                                  <span className="lv-live-match-teams">
                                    {m.team_a} vs {m.team_b}
                                  </span>
                                  {m.work_team && (
                                    <span className="lv-live-match-work">
                                      Work: {m.work_team}
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        ),
                      );
                    })()}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="lv-live-placeholder-heading">
                  This tournament hasn&rsquo;t started yet.
                </h2>
                <p className="lv-live-placeholder-text">
                  Pool assignments will appear here once registration closes and
                  teams are seeded.
                </p>
              </>
            )}

            <div className="lv-live-share" style={{ marginTop: "2rem" }}>
              <span className="lv-live-share-label">Registration link</span>
              <div className="lv-live-share-url">
                longvolleyball.com/longvolleyball/register?tournament=
                {selected.id}
              </div>
              <button
                className="lv-btn lv-btn-secondary"
                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/longvolleyball/register?tournament=${selected.id}`,
                  )
                }
              >
                Copy link
              </button>
            </div>
          </div>
        )}

        {/* === ARCHIVE VIEW === */}
        {selected && isArchive && (
          <>
            {archiveStandings?.pools?.length ? (
              <>
                {/* Champion banner */}
                {(() => {
                  const goldBracket = bracketData?.find(
                    (b) => b.bracket_type === "gold",
                  );
                  const silverBracket = bracketData?.find(
                    (b) => b.bracket_type === "silver",
                  );

                  if (goldBracket) {
                    // Champion = winner of the final match (highest round)
                    const getChampion = (
                      bracket: typeof goldBracket | null | undefined,
                    ) => {
                      if (!bracket) return null;
                      const finalRound = Math.max(
                        ...bracket.matches.map((m) => m.round_number),
                        0,
                      );
                      const finalMatch = bracket.matches.find(
                        (m) =>
                          m.round_number === finalRound &&
                          m.status === "complete",
                      );
                      if (
                        !finalMatch ||
                        finalMatch.score_a == null ||
                        finalMatch.score_b == null
                      )
                        return null;
                      return finalMatch.score_a > finalMatch.score_b
                        ? finalMatch.team_a
                        : finalMatch.team_b;
                    };

                    const goldChamp = getChampion(goldBracket);
                    const silverChamp = getChampion(silverBracket ?? null);

                    return (
                      <>
                        {goldChamp && (
                          <div className="lv-live-champion">
                            <span className="lv-live-champion-label">
                              Gold Bracket Champion
                            </span>
                            <span className="lv-live-champion-name">
                              {goldChamp}
                            </span>
                          </div>
                        )}
                        {silverChamp && (
                          <div
                            className="lv-live-champion"
                            style={{
                              background: "var(--lv-bg-dark-elevated)",
                              borderColor: "rgba(107, 78, 61, 0.3)",
                            }}
                          >
                            <span
                              className="lv-live-champion-label"
                              style={{ color: "var(--lv-cream-muted)" }}
                            >
                              Silver Bracket Champion
                            </span>
                            <span
                              className="lv-live-champion-name"
                              style={{ fontSize: "1.25rem" }}
                            >
                              {silverChamp}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  }

                  const topTeam = archiveStandings.pools[0]?.standings[0];
                  return topTeam ? (
                    <div className="lv-live-champion">
                      <span className="lv-live-champion-label">
                        Tournament Champion
                      </span>
                      <span className="lv-live-champion-name">
                        {topTeam.team_name}
                      </span>
                    </div>
                  ) : null;
                })()}

                {(poolTabs.length > 0 || bracketTabs.length > 0) && (
                  <PoolTabs
                    pools={poolTabs}
                    brackets={bracketTabs}
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                  />
                )}

                {renderTabContent()}
              </>
            ) : (
              <div className="lv-live-placeholder">
                <DecorativeAsset
                  src="cloud-1.png"
                  className="lv-live-placeholder-cloud"
                  width={100}
                  height={60}
                />
                <SectionDivider className="lv-live-placeholder-divider" />
                <h2 className="lv-live-placeholder-heading">
                  Results not available
                </h2>
                <p className="lv-live-placeholder-text">
                  Detailed results are not available for this tournament.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
