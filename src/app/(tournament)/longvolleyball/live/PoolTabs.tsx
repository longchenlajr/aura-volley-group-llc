"use client";

interface PoolTabInfo {
  id: string;
  label: string;
  courtNumber: number;
}

interface PoolTabsProps {
  pools: PoolTabInfo[];
  brackets: Array<{ id: string; label: string; type: "gold" | "silver" }>;
  activeTab: string | null; // null = overview
  onSelect: (tabId: string | null) => void;
  showResults?: boolean;
}

export function PoolTabs({ pools, brackets, activeTab, onSelect, showResults }: PoolTabsProps) {
  return (
    <div className="lv-pool-tabs">
      {showResults && (
        <button
          className={`lv-pool-tab ${activeTab === "results" ? "active" : ""}`}
          onClick={() => onSelect("results")}
        >
          Results
        </button>
      )}
      {brackets.map((b) => (
        <button
          key={b.id}
          className={`lv-pool-tab lv-pool-tab--${b.type} ${activeTab === b.id ? "active" : ""}`}
          onClick={() => onSelect(b.id)}
        >
          {b.label}
        </button>
      ))}
      <button
        className={`lv-pool-tab ${activeTab === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        Pool Overview
      </button>
      {pools.map((p) => (
        <button
          key={p.id}
          className={`lv-pool-tab ${activeTab === p.id ? "active" : ""}`}
          onClick={() => onSelect(p.id)}
        >
          Pool {p.label} · Court {p.courtNumber}
        </button>
      ))}
    </div>
  );
}
