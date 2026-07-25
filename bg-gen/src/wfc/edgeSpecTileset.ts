// Generalized version of tiledModel2.ts's approach — rotate a tile's own
// edge labels and match touching edges — but reading the base (unrotated)
// edges from JSON instead of a hardcoded array, so any tileset can use it
// once its edges have been derived from the real art (see
// scripts/derive_tile_edges.py). No symmetry letter or neighbor rules
// needed: cardinality falls out of rotating the edges and deduping
// identical results, and adjacency falls out of matching them — nothing
// here depends on an external rotation-direction convention, so there's
// nothing to get wrong the way realTileset.ts's mxgmn rule expansion can.
//
// Unlike tiledModel2.ts, matching here is *not* by string reversal.
// tiledModel2's hand-typed edges read the tile's perimeter clockwise, so
// two touching edges are naturally scanned in opposite directions and
// need reversing before comparison. scripts/derive_tile_edges.py instead
// samples each side along its own fixed image axis (N/S left-to-right,
// E/W top-to-bottom) — the same axis for every side of every tile — so
// two touching edges are already scanned in the same direction and
// compare directly. (Verified against the actual rendered pixels: direct
// comparison reduced Circuit's mismatched edges from ~47% down to ~2%,
// with the small remainder being genuine sub-pixel drawing inconsistency
// in the source art, not a matching-convention error — reversal made it
// *worse*, matching spurious pairs instead of the real ones.)

type Edges = [string, string, string, string] // N, E, S, W

export interface EdgeSpecTileDef {
  name: string
  weight: number
  edges: Edges
}

const DIRECTIONS = ['N', 'E', 'S', 'W'] as const
type Direction = (typeof DIRECTIONS)[number]
const OPPOSITE: Record<Direction, Direction> = { N: 'S', E: 'W', S: 'N', W: 'E' }

/** a manually-declared adjacency for tiles whose pixel art doesn't
 *  actually share a matching edge but should still be allowed to touch —
 *  e.g. Castle's "tower" is solid stone with no grass border anywhere
 *  (so it can never pixel-match anything but itself), but is meant to
 *  sit where a wall corner would be. `a`/`b` are "name orientation"
 *  refs (e.g. "tower 0"); `direction` is b's position relative to a. */
export interface ExtraCompatRule {
  a: string
  b: string
  direction: Direction
}

export interface EdgeSpecTilesetJson {
  tiles: EdgeSpecTileDef[]
  extraCompat?: ExtraCompatRule[]
}

export interface EdgeSpecOrientedTile {
  name: string
  /** rotation count, 0-3, applied clockwise in 90° steps */
  orientation: number
  weight: number
  edges: Edges
}

function reverseStr(s: string): string {
  return s.split('').reverse().join('')
}

// One 90°-CW pixel rotation doesn't just relabel which side is which — for
// a fixed-axis edge sampling (N/S left-to-right, E/W top-to-bottom), N and S
// pick up the perpendicular side's string *reversed*, since the sampling
// direction along that side flips under the rotation, while E and W pick up
// the perpendicular side direct (verified against rotate_cw's coordinate
// math: out[row][col] = in[N-1-col][row]). Composing this four-way swap
// `num` times gives the right answer for every rotation, including 180°
// where every side ends up reversed.
function rotateOnce(edges: Edges): Edges {
  const [n, e, s, w] = edges
  return [reverseStr(w), n, reverseStr(e), s]
}

function rotateEdges(edges: Edges, num: number): Edges {
  let result = edges
  for (let i = 0; i < num; i++) result = rotateOnce(result)
  return result
}

/** expands each tile into its unique rotations and derives the
 *  [tile][direction] compatibility table purely from edge-string matching */
export function buildEdgeSpecOrientedTiles(json: EdgeSpecTilesetJson): {
  tiles: EdgeSpecOrientedTile[]
  compat: number[][][]
} {
  const tiles: EdgeSpecOrientedTile[] = []
  for (const def of json.tiles) {
    const seen = new Set<string>()
    for (let o = 0; o < 4; o++) {
      const edges = rotateEdges(def.edges, o)
      const key = edges.join(',')
      if (seen.has(key)) continue
      seen.add(key)
      tiles.push({ name: def.name, orientation: o, weight: def.weight, edges })
    }
  }

  const compat: number[][][] = tiles.map(() => [[], [], [], []])
  for (let i = 0; i < tiles.length; i++) {
    for (let j = 0; j < tiles.length; j++) {
      const a = tiles[i].edges
      const b = tiles[j].edges
      if (b[2] === a[0]) compat[i][0].push(j) // b's south touches a's north
      if (b[3] === a[1]) compat[i][1].push(j) // b's west touches a's east
      if (b[0] === a[2]) compat[i][2].push(j) // b's north touches a's south
      if (b[1] === a[3]) compat[i][3].push(j) // b's east touches a's west
    }
  }

  if (json.extraCompat?.length) {
    const indexOf = new Map(tiles.map((t, i) => [`${t.name} ${t.orientation}`, i]))
    for (const rule of json.extraCompat) {
      const ai = indexOf.get(rule.a)
      const bi = indexOf.get(rule.b)
      if (ai === undefined) throw new Error(`extraCompat: unknown tile "${rule.a}"`)
      if (bi === undefined) throw new Error(`extraCompat: unknown tile "${rule.b}"`)
      const d = DIRECTIONS.indexOf(rule.direction)
      const od = DIRECTIONS.indexOf(OPPOSITE[rule.direction])
      compat[ai][d].push(bi)
      compat[bi][od].push(ai)
    }
  }

  return { tiles, compat }
}
