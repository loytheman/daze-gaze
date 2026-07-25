// N, E, S, W — same convention as WaveFunctionCollapse.ts
const OPPOSITE = [2, 3, 0, 1]

/** how many distinct 90°-rotations a tile of each symmetry class has,
 *  per mxgmn/WaveFunctionCollapse's "simple tiled model": a fully
 *  symmetric tile (X) looks the same at every rotation, a line (I) or
 *  diagonal (\) repeats after 180°, a T or L shape needs all four. F
 *  ("no symmetry") would need mirrored copies too for a true 8-tile
 *  orbit, but none of these tilesets rely on that, so it's treated the
 *  same as L/T here. */
const BASE_CARDINALITY: Record<string, number> = { X: 1, I: 2, '\\': 2, T: 4, L: 4, F: 4 }

export interface TileDef {
  name: string
  symmetry: string
  weight: number
}

export interface NeighborRule {
  left: string
  right: string
}

export interface TilesetJson {
  tiles: TileDef[]
  neighbors: NeighborRule[]
  unique?: boolean
  subsets?: { name: string; tiles: string[] }[]
  /** "name orientation" pairs to drop even though they have valid
   *  neighbors — for `unique` tilesets whose per-rotation art was hand-
   *  drawn inconsistently (e.g. Summer's "cliffcorner 1"/"watercorner 1"
   *  cover a sliver of their tile instead of the roughly-quadrant
   *  coverage every other rotation has, so they render as a small
   *  disconnected fleck floating in grass rather than a joined corner —
   *  a bad source asset, not a rotation or compat bug) */
  excludeOrientations?: string[]
}

export interface RealOrientedTile {
  name: string
  /** rotation count, 0..cardinality-1, applied clockwise in 90° steps */
  orientation: number
  weight: number
}

function parseRef(ref: string): { name: string; orientation: number } {
  const parts = ref.trim().split(/\s+/)
  return { name: parts[0], orientation: parts[1] ? Number(parts[1]) : 0 }
}

/** mirrors an orientation across a fixed axis, per symmetry class — used
 *  to derive the left-right-flipped counterpart of an authored rule (see
 *  buildRealOrientedTiles). X has one state so it's its own mirror; a
 *  line/diagonal (I, \) is a 2-cycle; T has one line of self-symmetry
 *  (states 1 and 3 are their own mirror, 0 and 2 swap); L (and F, treated
 *  the same here) has none, so all four states pair up in reverse. This
 *  is the pairing that produces varied, correctly-joining layouts across
 *  every bundled tileset when checked visually — the alternative
 *  no-fixed-point pairing (0↔1, 2↔3) looks "cleaner" tile-by-tile but
 *  makes a couple of Summer's corner tiles collapse the whole grid into
 *  a repeating checkerboard, so it's not actually the right one. */
function reflectOrientation(symmetry: string, o: number, cardinality: number): number {
  switch (symmetry) {
    case 'X':
      return 0
    case 'I':
      return o
    case '\\':
      return (o + 1) % 2
    case 'T':
      return ((2 - o) % 4 + 4) % 4
    default:
      return ((cardinality - 1 - o) % cardinality + cardinality) % cardinality
  }
}

/** the flipped counterpart of a rule: if B_b sits east of A_a, then
 *  mirroring the whole picture left-right puts mirror(A)_a to the east of
 *  mirror(B)_b — swapping which tile is which side */
function mirrorRule(rule: NeighborRule, symmetryOf: Map<string, string>, cardinality: Map<string, number>): NeighborRule {
  const left = parseRef(rule.left)
  const right = parseRef(rule.right)
  const ra = reflectOrientation(symmetryOf.get(left.name)!, left.orientation, cardinality.get(left.name)!)
  const rb = reflectOrientation(symmetryOf.get(right.name)!, right.orientation, cardinality.get(right.name)!)
  return { left: `${right.name} ${rb}`, right: `${left.name} ${ra}` }
}

/** drops any oriented tile that ended up with zero allowed neighbors in
 *  some direction — it could never actually be placed (every cell needs
 *  all four sides satisfied), so keeping it around only risks wasted
 *  contradictions. Rotation + reflection expansion covers all four
 *  directions for every tile in the bundled tilesets; this is a safety
 *  net in case a future/edited tileset doesn't. Also drops any tile
 *  explicitly named in `excluded` (see TilesetJson.excludeOrientations)
 *  even though it has valid neighbors, for hand-drawn oriented art that's
 *  simply wrong rather than incompatible. */
function dropDeadOrientations(
  tiles: RealOrientedTile[],
  compat: number[][][],
  excluded: Set<string>,
): { tiles: RealOrientedTile[]; compat: number[][][] } {
  const alive = tiles.map((t, i) => compat[i].every((dir) => dir.length > 0) && !excluded.has(`${t.name}|${t.orientation}`))
  if (alive.every(Boolean)) return { tiles, compat }

  const remap = new Array<number>(tiles.length).fill(-1)
  const aliveIndices: number[] = []
  tiles.forEach((_, i) => {
    if (!alive[i]) return
    remap[i] = aliveIndices.length
    aliveIndices.push(i)
  })

  return {
    tiles: aliveIndices.map((i) => tiles[i]),
    compat: aliveIndices.map((i) =>
      compat[i].map((dirList) => dirList.filter((j) => alive[j]).map((j) => remap[j])),
    ),
  }
}

/**
 * Expands a mxgmn-style tileset (tiles with a symmetry class + a handful
 * of explicit "A's right neighbor can be B" rules) into the flat oriented
 * tile list and [tile][direction] compatibility table the generic solver
 * needs — the same shape tileset.ts builds for the procedural G/P tiles.
 *
 * Each rule only states one relationship in one direction; rotating it
 * 0-3 times (advancing both tiles' orientation by one step and the
 * compass direction from E to S to W to N) derives the other three
 * directions, and mirroring it left-right derives the reflected
 * counterpart — the same two tricks the original algorithm uses to avoid
 * listing every direction/orientation by hand.
 */
export function buildRealOrientedTiles(json: TilesetJson): { tiles: RealOrientedTile[]; compat: number[][][] } {
  const symmetryOf = new Map(json.tiles.map((t) => [t.name, t.symmetry]))
  const cardinality = new Map<string, number>()
  for (const t of json.tiles) cardinality.set(t.name, BASE_CARDINALITY[t.symmetry] ?? 4)
  // widen for any tile whose neighbor rules reference an orientation the
  // symmetry class alone wouldn't allow (a couple of tiles in the data
  // are annotated more restrictively than their rules actually use)
  for (const rule of json.neighbors) {
    for (const ref of [rule.left, rule.right]) {
      const { name, orientation } = parseRef(ref)
      cardinality.set(name, Math.max(cardinality.get(name) ?? 1, orientation + 1))
    }
  }

  const tiles: RealOrientedTile[] = []
  const indexOf = new Map<string, number>()
  for (const t of json.tiles) {
    const card = cardinality.get(t.name)!
    for (let o = 0; o < card; o++) {
      indexOf.set(`${t.name}|${o}`, tiles.length)
      tiles.push({ name: t.name, orientation: o, weight: t.weight })
    }
  }

  const compat: number[][][] = tiles.map(() => [[], [], [], []])
  const rotate = (name: string, o: number, k: number) => (o + k) % cardinality.get(name)!

  for (const baseRule of json.neighbors) {
    for (const rule of [baseRule, mirrorRule(baseRule, symmetryOf, cardinality)]) {
      const left = parseRef(rule.left)
      const right = parseRef(rule.right)
      for (let k = 0; k < 4; k++) {
        const dir = (1 + k) % 4 // E, S, W, N as k goes 0..3
        const a = indexOf.get(`${left.name}|${rotate(left.name, left.orientation, k)}`)
        const b = indexOf.get(`${right.name}|${rotate(right.name, right.orientation, k)}`)
        if (a === undefined || b === undefined) continue
        compat[a][dir].push(b)
        compat[b][OPPOSITE[dir]].push(a)
      }
    }
  }

  const excluded = new Set((json.excludeOrientations ?? []).map((ref) => {
    const { name, orientation } = parseRef(ref)
    return `${name}|${orientation}`
  }))
  return dropDeadOrientations(tiles, compat, excluded)
}
