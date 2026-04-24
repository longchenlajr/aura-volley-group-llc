"use client";

import { getConnectorPaths, type LayoutConfig } from "@/lib/bracket-layout";

interface Props {
  totalRounds: number;
  firstRoundMatchCount: number;
  layout: LayoutConfig;
  width: number;
  height: number;
}

export function BracketConnectors({
  totalRounds,
  firstRoundMatchCount,
  layout,
  width,
  height,
}: Props) {
  const paths = getConnectorPaths(totalRounds, firstRoundMatchCount, layout);

  return (
    <svg
      className="bk-connectors"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="var(--lv-ink)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}
