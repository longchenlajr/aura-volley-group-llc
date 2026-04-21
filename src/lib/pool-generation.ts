export interface PoolGenerationInput {
  teams: Array<{ id: string; team_name: string; seed: number }>;
  netCount: number;
}

export interface GeneratedPool {
  pool_label: string;
  court_number: number;
  team_ids: string[];
}

export interface PoolGenerationOutput {
  pools: GeneratedPool[];
}

export interface PoolGenerationError {
  error: string;
}

export function generatePools(
  input: PoolGenerationInput,
): PoolGenerationOutput | PoolGenerationError {
  const { teams, netCount } = input;

  // --- Validation ---
  if (netCount < 1) {
    return { error: "Need at least 1 net." };
  }
  if (teams.length < 6) {
    return { error: "Need at least 6 teams to form pools (minimum 3 teams × 2 pools)." };
  }

  // Check all teams have seeds
  const unseeded = teams.filter((t) => t.seed == null);
  if (unseeded.length > 0) {
    return { error: `${unseeded.length} team(s) are missing seed numbers.` };
  }

  // Check for duplicate seeds
  const seedSet = new Set<number>();
  for (const t of teams) {
    if (seedSet.has(t.seed)) {
      return { error: `Duplicate seed #${t.seed} found.` };
    }
    seedSet.add(t.seed);
  }

  // --- Calculate pool sizes ---
  // Prefer fewer larger pools: e.g., 11 teams / 3 nets = 4/4/3
  const n = teams.length;
  const k = netCount;
  const base = Math.floor(n / k);
  const remainder = n % k;

  // Check pool sizes are reasonable (3-7)
  // 6 and 7 team pools use 2 courts simultaneously
  const maxPoolSize = base + (remainder > 0 ? 1 : 0);
  if (maxPoolSize > 7) {
    return {
      error: `Pool size would be ${maxPoolSize} teams, which exceeds the 7-team maximum. Add more nets or reduce teams.`,
    };
  }
  if (base < 3) {
    return {
      error: `Pool size would be ${base} teams, which is below the 3-team minimum. Reduce the number of nets.`,
    };
  }

  // --- Sort teams by seed ---
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);

  // --- Serpentine draft ---
  // First `remainder` pools get (base + 1) teams, rest get `base`
  const poolArrays: string[][] = Array.from({ length: k }, () => []);

  let direction = 1; // 1 = left-to-right, -1 = right-to-left
  let col = 0;

  for (let i = 0; i < n; i++) {
    poolArrays[col].push(sorted[i].id);

    const nextCol = col + direction;
    if (nextCol >= k || nextCol < 0) {
      direction *= -1;
    } else {
      col = nextCol;
    }
  }

  // --- Build output ---
  const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const pools: GeneratedPool[] = poolArrays
    .filter((p) => p.length > 0)
    .map((teamIds, i) => ({
      pool_label: LABELS[i] || `Pool ${i + 1}`,
      court_number: i + 1,
      team_ids: teamIds,
    }));

  return { pools };
}
