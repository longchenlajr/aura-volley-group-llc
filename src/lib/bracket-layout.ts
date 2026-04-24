/**
 * bracket-layout.ts — Pure functions for NCAA-style bracket positioning.
 *
 * Cards are absolutely positioned. Connector lines are SVG paths
 * computed from card positions. All math is deterministic and testable.
 */

export interface LayoutConfig {
  columnWidth: number;   // 200 desktop, 180 mobile
  cardHeight: number;    // 64 desktop, 60 mobile
  rowHeight: number;     // 80 desktop, 72 mobile
  columnGap: number;     // 48
  headerHeight: number;  // 32 (round label + margin)
  pageMargin: number;    // 20
}

export const DESKTOP_LAYOUT: LayoutConfig = {
  columnWidth: 200,
  cardHeight: 64,
  rowHeight: 96,
  columnGap: 48,
  headerHeight: 32,
  pageMargin: 20,
};

export const MOBILE_LAYOUT: LayoutConfig = {
  columnWidth: 180,
  cardHeight: 60,
  rowHeight: 88,
  columnGap: 48,
  headerHeight: 32,
  pageMargin: 12,
};

/**
 * Y position of a match card's top edge.
 *
 * Round 1: cards are evenly spaced at rowHeight intervals.
 * Round 2+: each card centers between its two feeder cards from previous round.
 *
 * @param roundNumber - 1-indexed round
 * @param matchIndex - 0-indexed position within the round
 * @param layout - layout config
 * @returns Y coordinate of card top edge (below header area)
 */
export function getMatchYPosition(
  roundNumber: number,
  matchIndex: number,
  layout: LayoutConfig,
): number {
  if (roundNumber === 1) {
    return matchIndex * layout.rowHeight + (layout.rowHeight - layout.cardHeight) / 2;
  }

  // Recursive: center between two feeders from previous round
  const feederIdx1 = matchIndex * 2;
  const feederIdx2 = matchIndex * 2 + 1;
  const y1 = getMatchYPosition(roundNumber - 1, feederIdx1, layout);
  const y2 = getMatchYPosition(roundNumber - 1, feederIdx2, layout);
  const center1 = y1 + layout.cardHeight / 2;
  const center2 = y2 + layout.cardHeight / 2;
  const midpoint = (center1 + center2) / 2;
  return midpoint - layout.cardHeight / 2;
}

/**
 * X position of a round column's left edge.
 */
export function getColumnXPosition(
  roundNumber: number,
  layout: LayoutConfig,
): number {
  return layout.pageMargin + (roundNumber - 1) * (layout.columnWidth + layout.columnGap);
}

/**
 * Total dimensions of the bracket area (excluding header).
 * Includes an extra champion column after the finals.
 */
export function getBracketDimensions(
  totalRounds: number,
  firstRoundMatchCount: number,
  layout: LayoutConfig,
): { width: number; height: number } {
  // +1 column for champion node
  const totalColumns = totalRounds + 1;
  const width =
    layout.pageMargin * 2 +
    totalColumns * layout.columnWidth +
    (totalColumns - 1) * layout.columnGap;

  const height = firstRoundMatchCount * layout.rowHeight;

  return { width, height };
}

/**
 * X position and Y position for the champion node (after finals).
 */
export function getChampionPosition(
  totalRounds: number,
  layout: LayoutConfig,
): { x: number; y: number } {
  const x = getColumnXPosition(totalRounds + 1, layout);
  const finalsY = getMatchYPosition(totalRounds, 0, layout);
  const finalsCenter = finalsY + layout.cardHeight / 2;
  const championHeight = layout.cardHeight / 2;
  // Center the champion node on the connector line (finals card center)
  return { x, y: finalsCenter - championHeight / 2 };
}

/**
 * SVG path strings for all connector lines between rounds.
 *
 * Each connector routes:
 * 1. Horizontal from feeder A right edge → 24px right
 * 2. Horizontal from feeder B right edge → 24px right
 * 3. Vertical trunk connecting the two horizontal endpoints
 * 4. Horizontal from trunk midpoint → next round card left edge
 */
export function getConnectorPaths(
  totalRounds: number,
  firstRoundMatchCount: number,
  layout: LayoutConfig,
): Array<{ d: string }> {
  const paths: Array<{ d: string }> = [];
  const stubLength = 24;

  for (let round = 1; round < totalRounds; round++) {
    const matchesInRound = firstRoundMatchCount / Math.pow(2, round - 1);
    const colX = getColumnXPosition(round, layout);
    const nextColX = getColumnXPosition(round + 1, layout);

    for (let i = 0; i < matchesInRound; i += 2) {
      const feederAY = getMatchYPosition(round, i, layout) + layout.cardHeight / 2;
      const feederBY = getMatchYPosition(round, i + 1, layout) + layout.cardHeight / 2;
      const trunkX = colX + layout.columnWidth + stubLength;
      const midY = (feederAY + feederBY) / 2;

      // Horizontal stub from feeder A
      const feederARight = colX + layout.columnWidth;
      // Horizontal stub from feeder B
      const feederBRight = colX + layout.columnWidth;

      const d = [
        // Feeder A horizontal stub
        `M ${feederARight} ${feederAY} L ${trunkX} ${feederAY}`,
        // Feeder B horizontal stub
        `M ${feederBRight} ${feederBY} L ${trunkX} ${feederBY}`,
        // Vertical trunk
        `M ${trunkX} ${feederAY} L ${trunkX} ${feederBY}`,
        // Horizontal line from trunk midpoint to next card
        `M ${trunkX} ${midY} L ${nextColX} ${midY}`,
      ].join(" ");

      paths.push({ d });
    }
  }

  // Champion connector: horizontal line from finals right edge to champion node
  const finalsColX = getColumnXPosition(totalRounds, layout);
  const finalsY = getMatchYPosition(totalRounds, 0, layout) + layout.cardHeight / 2;
  const championColX = getColumnXPosition(totalRounds + 1, layout);
  paths.push({
    d: `M ${finalsColX + layout.columnWidth} ${finalsY} L ${championColX} ${finalsY}`,
  });

  return paths;
}
