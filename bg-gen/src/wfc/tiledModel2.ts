// Port of the original Coding Train tiled-model WFC (_ref/p5js/tiled-model):
// each tile's 4 edges are hand-labeled with a short string, and two tiles
// can be neighbors when the touching edges are exact reverses of each
// other (a tile's own edge string is always read left-to-right/top-to-
// bottom, so two tiles that share a seam read it in opposite order).
// This is a different, older technique than realTileset.ts (symmetry +
// neighbor rules) or hybridEdges.ts (auto pixel matching) — ported as-is
// rather than folded into either.

type Edges = [string, string, string, string] // N, E, S, W

// tiles[0..12] from tiled-model/sketch.js setup(), for the
// circuit-coding-train tile images
const BASE_EDGES: Edges[] = [
  ['AAA', 'AAA', 'AAA', 'AAA'],
  ['BBB', 'BBB', 'BBB', 'BBB'],
  ['BBB', 'BCB', 'BBB', 'BBB'],
  ['BBB', 'BDB', 'BBB', 'BDB'],
  ['ABB', 'BCB', 'BBA', 'AAA'],
  ['ABB', 'BBB', 'BBB', 'BBA'],
  ['BBB', 'BCB', 'BBB', 'BCB'],
  ['BDB', 'BCB', 'BDB', 'BCB'],
  ['BDB', 'BBB', 'BCB', 'BBB'],
  ['BCB', 'BCB', 'BBB', 'BCB'],
  ['BCB', 'BCB', 'BCB', 'BCB'],
  ['BCB', 'BCB', 'BBB', 'BBB'],
  ['BBB', 'BCB', 'BBB', 'BCB'],
]

/** tile 5 (the lone diagonal wire) doesn't connect to itself — same
 *  special case as the original sketch.js `analyze()` */
const NO_SELF_MATCH = new Set([5])

export interface TiledModel2Tile {
  /** which of the 13 base tile images this orientation came from */
  index: number
  /** rotation count, 0-3, applied clockwise in 90° steps */
  orientation: number
  edges: Edges
}

function reverseString(s: string): string {
  return [...s].reverse().join('')
}

function edgesMatch(a: string, b: string): boolean {
  return a === reverseString(b)
}

function rotateEdges(edges: Edges, num: number): Edges {
  const len = edges.length
  return edges.map((_, i) => edges[(i - num + len) % len]) as Edges
}

/** expands the 13 base tiles into their unique rotations and derives the
 *  [tile][direction] compatibility table from edge-string matching */
export function buildTiledModel2Tiles(): { tiles: TiledModel2Tile[]; compat: number[][][] } {
  const tiles: TiledModel2Tile[] = []
  BASE_EDGES.forEach((base, index) => {
    const seen = new Set<string>()
    for (let o = 0; o < 4; o++) {
      const edges = rotateEdges(base, o)
      const key = edges.join(',')
      if (seen.has(key)) continue
      seen.add(key)
      tiles.push({ index, orientation: o, edges })
    }
  })

  const compat: number[][][] = tiles.map(() => [[], [], [], []])
  for (let i = 0; i < tiles.length; i++) {
    for (let j = 0; j < tiles.length; j++) {
      if (tiles[i].index === tiles[j].index && NO_SELF_MATCH.has(tiles[i].index)) continue
      const a = tiles[i].edges
      const b = tiles[j].edges
      if (edgesMatch(b[2], a[0])) compat[i][0].push(j) // b's south touches a's north
      if (edgesMatch(b[3], a[1])) compat[i][1].push(j) // b's west touches a's east
      if (edgesMatch(b[0], a[2])) compat[i][2].push(j) // b's north touches a's south
      if (edgesMatch(b[1], a[3])) compat[i][3].push(j) // b's east touches a's west
    }
  }

  return { tiles, compat }
}
