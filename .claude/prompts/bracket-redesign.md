Claude Code Prompt — Playoff Bracket Rebuild (NCAA-Style)

Rebuild the playoff bracket view from scratch. Traditional NCAA March Madness layout — rounds aligned vertically in columns, horizontal connectors between rounds, bracket tree structure preserved on all screen sizes. Mobile scrolls horizontally through rounds; desktop shows the full bracket if it fits or scrolls horizontally if it doesn't. Sleek and information-dense, not chunky.
Delete the current BracketView.tsx implementation and build clean.

1. Layout architecture
The bracket is a horizontal sequence of round columns. Each column contains match slots. Match slots in later rounds are vertically centered between their two feeder matches' vertical midpoints. SVG or CSS connector lines join each match to the next round.
Column structure:

Fixed column width: 220px (team slot width + padding)
Horizontal gap between columns: 48px (gives connector lines room to route cleanly)
First column aligns to left edge with 20px page margin
Round header above each column

Match slot placement within columns:
This is the part that has to be mathematically sound. Use a recursive calculation based on round number:
Round 1 card positions:
  - Card N vertical center = BASE_Y + (N - 1) × ROW_HEIGHT

Round 2+ card positions:
  - Card N vertical center = midpoint of feeder match N1 and feeder match N2 from previous round
  - Equivalent to: BASE_Y + ((N - 1) × 2 × ROW_HEIGHT) + (ROW_HEIGHT / 2) × (2^(round - 1) - 1) + halfCardHeight

Where:
  - ROW_HEIGHT = 80px (desktop) / 72px (mobile)
  - CARD_HEIGHT = 64px (desktop) / 60px (mobile)
  - BASE_Y = 0px (top of bracket area, under round headers)
Implementation approach: compute each card's Y position in a pure function based on its round and position. Do not use flex layout with growing spacers — that breaks connector alignment. Use absolute positioning within a container of known height.
Container height formula: ROW_HEIGHT × firstRoundCardCount + headerHeight + bottomPadding

2. Match slot design (team box)
The slot is a single card containing two team rows. Sleek, not chunky.
Card spec:

Width: 200px (fixed)
Height: 64px total (32px per team row)
Background: --lv-bg-elevated
Border: 1px solid --lv-ink at 15% opacity for scheduled / --lv-red solid for in-progress / --lv-green solid for complete
Border-radius: 6px
No shadow, no gradient

Team row (32px each):

Left-aligned seed number: 12px tabular, ink-muted, 24px wide column
Team name: 13px, ink, weight 500, truncates with ellipsis at ~120px
Right-aligned score: 13px, tabular-nums, weight 600, 28px wide column
Thin 1px horizontal divider between the two team rows, ink at 10%

States:
StateBorderLoser treatmentScheduled1px ink at 20%—In progress1px crimsonsmall "LIVE" dot at top-right, 6px solid crimson circleComplete1px greenLoser row: 40% opacity + line-through on team name onlyBYE1px dashed ink at 20%"BYE" text centered, 12px ink-muted
Keep LIVE indicator minimal — just a dot, no pill or text. Space is tight in a 64px card.
Card total footprint: 200px × 64px. No additional court labels on the card (remove if currently there — court info belongs in the pool view, not the bracket). Bracket is about tournament progression; operational detail lives elsewhere.

3. Round headers

Positioned above each column, 20px margin below header
Text: "ROUND 1", "QUARTERFINALS", "SEMIFINALS", "FINAL" in Fraunces 600, 12px, tracked +0.1em, crimson
1px horizontal line below text, 40px wide, aligned left with column, crimson
Headers are part of the scrollable area — they scroll with the bracket on mobile


4. Connector lines
Rendered as SVG paths within a single <svg> element that overlays the entire bracket area. Lines are computed from match positions and drawn mathematically.
Connector routing between two feeder matches and one next-round match:
Feeder match A (top) exits at: (columnRight, feederACenter)
Feeder match B (bottom) exits at: (columnRight, feederBCenter)
Next-round match enters at: (nextColumnLeft, nextRoundCenter)

Line path:
  1. From (feederARight, feederACenter) horizontal 24px to (feederARight + 24, feederACenter)
  2. From (feederARight + 24, feederACenter) vertical down to (feederARight + 24, feederBCenter)
  3. Stays at that x-coordinate — this is the vertical trunk
  4. From (feederARight + 24, (feederACenter + feederBCenter) / 2) horizontal to (nextColumnLeft - 4, (feederACenter + feederBCenter) / 2)
Wait — that routes incorrectly. Correct routing:
1. Horizontal line from feeder A right edge extending 24px rightward, ending at (columnRight + 24, feederACenter)
2. Horizontal line from feeder B right edge extending 24px rightward, ending at (columnRight + 24, feederBCenter)
3. Vertical line connecting the two horizontal endpoints: from (columnRight + 24, feederACenter) to (columnRight + 24, feederBCenter)
4. Horizontal line from the vertical trunk's midpoint to the next round card: from (columnRight + 24, (feederACenter + feederBCenter) / 2) to (nextColumnLeft, nextRoundCenter)
Note the critical constraint: (feederACenter + feederBCenter) / 2 must equal nextRoundCenter for the geometry to be clean. This is why match position math in section 1 matters — if positioning is calculated correctly, connectors align naturally.
Line spec:

Stroke: --lv-ink at 60% opacity (solid, not dashed)
Stroke width: 1.5px
Line caps: butt (not round)
NO colored lines, NO crimson connectors — connectors are structural, not decorative

BYE handling:

BYE cards get a connector line like any other match
The line routes through as if the BYE "won" automatically


5. Mobile behavior
Same layout as desktop. Same card dimensions (or slightly tighter — 180px × 60px if needed). Same connectors. The difference is the outer container:

Wrapped in a horizontally scrolling container
Scroll indicator visible at top or bottom showing position within the bracket
Sticky "jump to round" tabs at top of page: "1 · QF · SF · F" — tapping scrolls horizontally to that round
Momentum scroll enabled (-webkit-overflow-scrolling: touch)
Visual affordance: on first load, gentle nudge-animation slides the bracket 20px right and back over 800ms to signal horizontal scrollability

Mobile-specific card adjustments:

Reduce card width to 180px (fits more columns in viewport)
Reduce team name font to 12px
Tap on a card opens match detail modal (same detail shown on desktop hover)

Round headers scroll with the bracket, not sticky.

6. Champion treatment
When the final match completes:

Winner card gets a 2px solid gold border (gold bracket) or 2px solid slate-gray #6B7280 (silver bracket)
Small trophy icon positioned absolutely at top-right corner of the winner card, 16px, same color as border
No animation — clean and dignified


7. Scrolling and responsive logic
Desktop (≥1024px):

If full bracket fits in container (≤880px wide typically), display without scroll
If wider, horizontal scroll within the bracket area (not the whole page)
Scrollbar visible during hover/scroll

Tablet and mobile (<1024px):

Always horizontal scroll within bracket container
No scrollbar (hide with CSS: ::-webkit-scrollbar { display: none } + scrollbar-width: none)
Round tab navigation provides discoverability


8. Gold vs silver identity
Minimal differentiation — only the header ornament and champion border change:

Gold bracket header: "GOLD BRACKET" text with small solid gold 8-point star (12px) next to it
Silver bracket header: "SILVER BRACKET" text with small slate-gray 8-point star (12px) next to it

Everything else — card borders, connectors, text colors — is identical. Identity through accent, not saturation.

9. Container and outer layout

Bracket container: full width of Live page content area
Horizontal scrolling: overflow-x: auto, overflow-y: hidden
Height: computed from formula above (match count × row height + header)
Internal padding: 20px top, 40px bottom (room for champion trophy ornament)
Background: page parchment (no additional container background)


10. Implementation specifics
Files to create:

src/app/(tournament)/longvolleyball/live/BracketView.tsx — rewrite from scratch
src/app/(tournament)/longvolleyball/live/BracketMatchCard.tsx — single match slot component
src/app/(tournament)/longvolleyball/live/BracketConnectors.tsx — SVG overlay component
src/lib/bracket-layout.ts — pure functions computing match positions from round + index

Files to modify:

src/app/(tournament)/tournament.css — bracket-specific styles

Key functions in bracket-layout.ts:
typescriptexport function getMatchYPosition(
  roundNumber: number,
  matchIndex: number,
  firstRoundCardCount: number,
  rowHeight: number,
  cardHeight: number
): number {
  // For round 1: matchIndex × rowHeight + rowHeight/2 - cardHeight/2
  // For round 2+: midpoint between the two feeder cards in the previous round
  // Returns Y coordinate of the card's top edge
}

export function getColumnXPosition(
  roundNumber: number,
  columnWidth: number,
  columnGap: number
): number {
  // Returns X coordinate of the column's left edge
}

export function getConnectorPaths(
  matches: BracketMatch[],
  layout: LayoutConfig
): Array<{ d: string }> {
  // Returns SVG path strings for all connectors
}
Pure functions, testable in isolation. The BracketView component uses them to position cards absolutely and draw connectors.

11. Verify

npm run build passes
Bracket renders correctly for 4-team, 6-team, 8-team, 16-team configurations
Connector lines geometrically align — no bent/crooked routing, no visual misalignment between rounds
Match slots are 200×64 desktop, 180×60 mobile, consistent across all rounds
Horizontal scroll works smoothly on mobile, momentum-scroll enabled
Round jump tabs on mobile scroll horizontally to the target round
Winner treatment (strikethrough + opacity) reads clearly in daylight simulation
Champion trophy appears on final round winner
Gold/silver differentiation is visible in header only
Bracket does not overflow vertically — container height matches actual content height


Do not build yet. First confirm:

Your plan for the math in getMatchYPosition — specifically how you handle BYE slots in round 1 (do they take up a full row, half a row, or zero space?) and how this affects round 2 vertical centering
Whether connector lines should be drawn in one SVG overlay per bracket or individually per round — tradeoffs
Your handling of irregular bracket sizes (6-team bracket has 2 byes in round 1, 5-team has 3 byes) — how positioning math stays clean with those
Mobile horizontal scroll — do you use native CSS overflow-x: auto with snap-align per column, or library-based? My take: native CSS scroll, no library
Whether the "jump to round" tabs on mobile should also be present on desktop for parity — my take: no, desktop shows full bracket or scrolls naturally; tabs are a mobile-only concession