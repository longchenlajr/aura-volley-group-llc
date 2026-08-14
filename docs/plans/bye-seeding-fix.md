# Implementation Plan — Guarantee byes go to the top-seeded teams

**Audience:** an implementing model/engineer picking this up cold. Every non-obvious
step is spelled out. Do not skip the "Worked example" or "Testing" sections — they are
how you know you got it right.

**File to change:** `src/lib/bracket-generation.ts` (only this file).

**Do NOT touch:** court assignment, work-team assignment, match building, or anything
outside the seeding helpers named below. Those all read `slot.is_bye` and slot positions;
they don't care which team is in which slot, so they need no changes.

---

## 1. Background: what the code does today

`generateBracket()` (top of `bracket-generation.ts`) builds a single-elimination bracket.
Near the top it calls:

```ts
const seeded = seedWithPoolSeparation(sorted, bracketSize);
```

- `sorted` = the teams, sorted by `overall_rank` ascending (rank 1 = best). Length `n`.
- `bracketSize` = next power of 2 ≥ `n` (e.g. 11 teams → 16).
- `seeded` = an array of length `bracketSize`. Each entry is a team **or `null`**.
  A `null` means that R1 slot is a **bye**. There are `byeCount = bracketSize - n` nulls.

`seedWithPoolSeparation()` → `placeRegion()` (both near the bottom of the file) decide the
order. `placeRegion` recursively splits a slot-range into a top half and bottom half,
dealing teams (strongest first) into the two halves with this priority:
1. **Capacity** — a half can't exceed its slot count.
2. **Pool separation** — if one half already has a team from the same pool and the other
   doesn't, put this team in the half WITHOUT the pool-mate (so pool-mates meet as late as
   possible).
3. Otherwise follow the standard single-elim snake pattern (`standardSidePattern`).

Byes are represented as `null` entries appended to the END of the team list, and they flow
through the same bisection.

## 2. The bug

Because byes (`null`) are dealt through the same bisection as real teams, **pool separation
can move real teams between halves, which changes how many byes land in each half**, which in
turn can hand a bye to a lower-ranked team while a higher-ranked team plays a Round-1 game.

Concrete failure (real case: pools of 4, 4, 3 = 11 teams, `bracketSize` 16, `byeCount` 5):
byes were awarded to overall ranks **{1, 3, 5, 6, 7}** instead of the correct **{1, 2, 3, 4, 5}**.
Rank 2 (`B1`) played a Round-1 match while rank 7 (`A3`) got a bye.

**Desired behavior:** the `byeCount` byes must ALWAYS go to the top `byeCount` teams by
`overall_rank`, while still keeping pool separation for the actual matchups.

## 3. Strategy (read this before writing code)

Split the problem into two groups and never let a team cross between them:

- **Bye group** = the top `byeCount` teams by rank. These MUST get byes.
- **Play group** = everyone else. These play Round 1.

Then place each group into the slots that the *standard* bracket structure reserves for that
group, applying pool separation WITHIN this constraint. Because the group split is by rank,
byes are guaranteed to go to the top `byeCount` teams — by construction, not by luck.

**Critical safety property:** when `byeCount === 0` (team count is already a power of 2), we
take the EXISTING code path unchanged. Every current test uses either a power-of-2 team count
(→ `byeCount === 0`) or distinct/identical pools, so this guarantees we don't regress them.
The new code path only runs when `byeCount > 0`.

## 4. Slot classification (the key precomputation)

There is already a helper `bracketSeedOrder(size)` in the file. `bracketSeedOrder(bracketSize)`
returns an array where `order[slotIndex]` = the **seed number** (1..bracketSize) that standard
seeding places at that slot. Example for size 8: `[1, 8, 4, 5, 2, 7, 3, 6]`.

Using it, classify every slot (0-indexed `0..bracketSize-1`) into one of THREE types:

```
seedOrder = bracketSeedOrder(bracketSize)
for each slot:
    seedNum = seedOrder[slot]
    if seedNum > n:
        type = 'BYE'        // holds a null (this is a bye)
    else:
        partnerSlot = (slot is even) ? slot + 1 : slot - 1   // the R1 opponent slot
        partnerSeed = seedOrder[partnerSlot]
        if partnerSeed > n:
            type = 'BYEWIN' // a real team whose R1 opponent is a bye → this team gets a bye
        else:
            type = 'PLAY'   // a real team that plays a real R1 game
```

Guaranteed counts (assert these):
- `count(BYE)   === byeCount`
- `count(BYEWIN)=== byeCount`   (each BYE slot's partner is a BYEWIN slot)
- `count(PLAY)  === n - byeCount`  (always even; it's 2 × number of real R1 games)

So: **BYEWIN slots receive the bye group; PLAY slots receive the play group; BYE slots get null.**

## 5. The placement algorithm

Replace `seedWithPoolSeparation` and `placeRegion` with the following. Keep
`bracketSeedOrder`, `standardSidePattern`, `nextPowerOf2`, and `getRoundLabel` as-is.

```
function seedWithPoolSeparation(teams /* sorted by rank asc */, bracketSize):
    n = teams.length
    byeCount = bracketSize - n

    // SAFETY: preserve existing behavior exactly when there are no byes.
    if byeCount === 0:
        return legacyPlaceRegion(teams, bracketSize)   // the CURRENT algorithm, unchanged

    slotType = classifySlots(teams, bracketSize)   // array of 'BYE' | 'BYEWIN' | 'PLAY', per Section 4

    byeGroup  = teams.slice(0, byeCount)     // top byeCount ranked → get byes
    playGroup = teams.slice(byeCount)        // the rest → play R1

    slots = new Array(bracketSize).fill(null)
    place(byeGroup, playGroup, 0, bracketSize, slotType, slots)
    return slots
```

`place()` recursively bisects a slot-range, routing each group into its slot type with
capacity limits + pool separation:

```
function place(byeGroup, playGroup, slotStart, regionSize, slotType, slots):
    if regionSize === 1:
        t = slotType[slotStart]
        if t === 'BYE':    slots[slotStart] = null
        elif t === 'BYEWIN': slots[slotStart] = byeGroup[0]    // exactly one element here
        else /* PLAY */:     slots[slotStart] = playGroup[0]   // exactly one element here
        return

    half = regionSize / 2
    topStart = slotStart
    botStart = slotStart + half

    // Fixed capacities for each half, from the standard slot structure:
    byeWinCap_top = count of 'BYEWIN' slots in [topStart, topStart + half)
    playCap_top   = count of 'PLAY'   slots in [topStart, topStart + half)
    byeWinCap_bot = count of 'BYEWIN' slots in [botStart, botStart + half)
    playCap_bot   = count of 'PLAY'   slots in [botStart, botStart + half)

    // Merge both groups into ONE list, strongest first (byeGroup and playGroup are each
    // already rank-sorted; merge them back into overall rank order and remember each
    // team's group). Merging lets pool separation see BOTH groups at once (cross-group
    // awareness) while still routing each team into its own group's capacity.
    merged = mergeByOverallRank(byeGroup, playGroup)   // ascending overall_rank

    topList = []   // teams assigned to top half (both groups, for pool checks)
    botList = []
    byeTop = [], byeBot = [], playTop = [], playBot = []   // per-group outputs
    usedByeTop = 0, usedByeBot = 0, usedPlayTop = 0, usedPlayBot = 0

    for team in merged:                      // strongest first
        isBye = team is in byeGroup
        capTop  = isBye ? byeWinCap_top : playCap_top
        capBot  = isBye ? byeWinCap_bot : playCap_bot
        usedTop = isBye ? usedByeTop : usedPlayTop
        usedBot = isBye ? usedByeBot : usedPlayBot

        // 1) Hard capacity: if one side is full for this group, forced to the other.
        if usedTop >= capTop:
            side = BOTTOM
        elif usedBot >= capBot:
            side = TOP
        else:
            // 2) Pool separation: prefer the side that does NOT already hold a pool-mate.
            pool = team.pool_label
            topHasPool = topList has any team with this pool
            botHasPool = botList has any team with this pool
            if topHasPool and not botHasPool:
                side = BOTTOM
            elif botHasPool and not topHasPool:
                side = TOP
            else:
                // 3) Default / tie-break: put the team where its group has MORE remaining
                //    capacity (spreads each group evenly across halves); tie → TOP.
                remTop = capTop - usedTop
                remBot = capBot - usedBot
                side = (remTop >= remBot) ? TOP : BOTTOM

        if side === TOP:
            topList.push(team)
            if isBye: byeTop.push(team); usedByeTop++    else: playTop.push(team); usedPlayTop++
        else:
            botList.push(team)
            if isBye: byeBot.push(team); usedByeBot++     else: playBot.push(team); usedPlayBot++

    place(byeTop, playTop, topStart, half, slotType, slots)
    place(byeBot, playBot, botStart, half, slotType, slots)
```

`legacyPlaceRegion` = the body of the current `placeRegion`/`seedWithPoolSeparation` (rename
it, keep it verbatim). It is only reached when `byeCount === 0`.

### Notes for the implementer
- `mergeByOverallRank`: both inputs are already sorted ascending by `overall_rank`; do a
  standard 2-pointer merge, or concatenate and re-sort by `overall_rank`. Either is fine.
- "team is in byeGroup": compute once as a `Set<string>` of `byeGroup` team_ids and check
  membership; don't rely on object identity across the merge.
- The capacity counters make the recursion self-consistent: the number of bye teams handed
  to a sub-region always equals the number of BYEWIN slots in it, and likewise for play.
  Add an assertion at the top of `place` (dev-only) verifying
  `byeGroup.length === count(BYEWIN in region)` and
  `playGroup.length === count(PLAY in region)`; if it ever fails, the capacity math is wrong.
- Do not mutate the input `teams` array (there's a test for this — sort a copy).

## 6. Worked example — verify your implementation against these exact numbers

Field: pool A (4 teams), pool B (4 teams), pool C (3 teams) = 11 teams. `bracketSize = 16`,
`byeCount = 5`.

Teams by overall rank (rank : team : pool):
`1:A1(A) 2:B1(B) 3:C1(C) 4:A2(A) 5:B2(B) 6:C2(C) 7:A3(A) 8:B3(B) 9:C3(C) 10:A4(A) 11:B4(B)`

Slot classification (`seedOrder16 = [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]`):
- BYEWIN slots (0-indexed): `0, 4, 6, 8, 12`
- BYE slots: `1, 5, 7, 9, 13`
- PLAY slots: `2, 3, 10, 11, 14, 15`

Correct output (this is what your code must produce — verify with a test):

**Byes go to exactly the top 5 ranked teams:** `{A1, B1, C1, A2, B2}`.

**Round-1 PLAY games (each is different-pool):**
- `C2 vs A4`  (C vs A)
- `A3 vs B4`  (A vs B)
- `B3 vs C3`  (B vs C)

**Same-pool separation (earliest round any two pool-mates can meet):**
- Pool A (A1,A2,A3,A4): earliest meeting = **R3 (semifinals)** — optimal (one per quarter).
- Pool B (B1,B2,B3,B4): earliest meeting = **R3** — optimal.
- Pool C (C1,C2,C3): earliest meeting = **R3** — optimal.

No same-pool pair meets in R1 or R2. (Exact slot positions may differ from a hand-trace as
long as the three properties above hold: byes→top-5, no same-pool R1, no same-pool meeting
before R3.)

## 7. Testing

Add tests to `src/lib/__tests__/bracket-generation.test.ts`. Use the existing `makeTeam(rank, pool)`
helper and the existing `meetRound(slotA, slotB, bracketSize)` / `hasBye(bracket, teamId)`
helpers.

**First: run the existing suite unchanged — everything must still pass.**
`npx vitest run --project unit`. The pool-separation and standard-order tests use 8-team
(power-of-2) fields → `byeCount === 0` → legacy path → must be byte-for-byte identical.

**New tests (new path, `byeCount > 0`):**

1. **Byes go to the top `byeCount` ranked teams (the actual bug).** Build the 4/4/3 field
   from Section 6 (11 teams, `bracketSize` 16). Assert the set of teams with `hasBye() === true`
   is exactly `{A1, B1, C1, A2, B2}` (ranks 1–5). This test should FAIL against the current
   code and PASS after the fix.

2. **No same-pool team pair in any R1 match**, for the 4/4/3 field. Iterate
   `bracket.matches.filter(round_number === 1)` and assert `pool(team_a) !== pool(team_b)`.

3. **Same-pool teams meet no earlier than semis** for the 4/4/3 field: for every pair of
   same-pool teams, `meetRound(...) >= 2` for all pairs and the pool's minimum is R3 (per
   Section 6, all three pools reach R3). Use `meetRound` on the two teams' R1 slot positions.

4. **A second, lopsided field** to prevent over-fitting to 4/4/3. Suggested: one pool of 6 +
   one pool of 2 = 8 teams → power of 2, `byeCount 0` (legacy path) — so instead use pools of
   5 + 4 + 2 = 11, or 6 + 5 = 11, and assert (a) byes = top `byeCount` ranks, (b) no same-pool
   R1. (With a pool of 6 in a 16-bracket, some same-pool pairs CAN be forced to meet before the
   final — that's mathematically unavoidable; only assert no same-pool R1, not the meet-round.)

## 8. The one documented tradeoff (call it out in a code comment)

Bye assignment (top `byeCount` by rank) is now a **hard** rule and always wins. Pool
separation is applied within each group and is cross-group aware in the tie-break, but in the
rare case where one pool has members in BOTH the bye group and the play group, the two groups
are routed into different slot types, so "maximum possible separation across the entire field"
can occasionally lose to "byes strictly by rank." This is intentional and matches standard
tournament convention. The hard guarantee that **no two same-pool teams meet in Round 1** is
unaffected (byes don't play R1 at all). Add a short comment at the top of the new
`seedWithPoolSeparation` stating this.

## 9. Definition of done

- [ ] `byeCount === 0` path is the old algorithm, untouched; full existing suite passes.
- [ ] New path gives byes to the top `byeCount` teams by `overall_rank` (test #1).
- [ ] No same-pool pair in any R1 match (test #2, #4).
- [ ] 4/4/3 field: all three pools' earliest same-pool meeting is R3 (test #3).
- [ ] Input `teams` array not mutated.
- [ ] `npx tsc --noEmit` clean; `npx vitest run --project unit` green.
- [ ] Tradeoff comment added (Section 8).
