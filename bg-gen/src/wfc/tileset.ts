import type { BaseTile, Edges, OrientedTile } from './types'

/** hand-authored tiles in their base orientation — every rotation is
 *  generated from these, so we only need to describe each shape once.
 *  the six shapes below happen to cover all 16 possible G/P edge
 *  combinations, so the solver can never paint itself into a corner */
const BASE_TILES: BaseTile[] = [
  { edges: ['G', 'G', 'G', 'G'], weight: 6 }, // blank
  { edges: ['P', 'G', 'P', 'G'], weight: 3 }, // straight
  { edges: ['P', 'P', 'G', 'G'], weight: 3 }, // corner
  { edges: ['P', 'P', 'P', 'G'], weight: 2 }, // t-junction
  { edges: ['P', 'P', 'P', 'P'], weight: 1 }, // cross
  { edges: ['P', 'G', 'G', 'G'], weight: 1 }, // dead end
]

function rotateCW(edges: Edges): Edges {
  const [n, e, s, w] = edges
  return [w, n, e, s]
}

/** expands the base tiles into all four rotations, collapsing duplicate
 *  edge signatures (a fully symmetric tile rotates onto itself) */
export function buildOrientedTiles(): OrientedTile[] {
  const bySignature = new Map<string, OrientedTile>()
  for (const base of BASE_TILES) {
    let edges = base.edges
    for (let r = 0; r < 4; r++) {
      const key = edges.join('')
      if (!bySignature.has(key)) bySignature.set(key, { edges, weight: base.weight })
      edges = rotateCW(edges)
    }
  }
  return [...bySignature.values()]
}
