import type { Tile, TilesetType } from '../tileset'

// N, E, S, W — same convention as WaveFunctionCollapse.ts.
const EDGE_BITS = [1, 2, 4, 8]
const EDGE_OPPOSITE = [2, 3, 0, 1]

/**
 * Edge tilesets (e.g. road): a tile with a connection facing direction d
 * needs its neighbor in that direction to have a matching connection
 * facing back (the opposite direction), otherwise it would just dead-end
 * into a tile with nothing to meet it.
 */
function buildEdgeCompat(tiles: Tile[]): number[][][] {
  const has = (tile: Tile, d: number) => (tile.mask & EDGE_BITS[d]) !== 0

  return tiles.map((a) =>
    EDGE_BITS.map((_, d) => {
      const opposite = EDGE_OPPOSITE[d]
      return tiles
        .map((b, j) => (has(a, d) === has(b, opposite) ? j : -1))
        .filter((j) => j !== -1)
    }),
  )
}

// NE, SE, SW, NW
const CORNER = { NE: 1, SE: 2, SW: 4, NW: 8 }

/** for each direction, the [a's corner, b's corner] pairs that sit at
 *  the same physical point along that shared edge and so must agree —
 *  e.g. if b sits north of a, a's top-left (NW) corner is the same point
 *  as b's bottom-left (SW) corner, and a's top-right (NE) is b's
 *  bottom-right (SE) */
const SHARED_CORNERS: [number, number][][] = [
  [
    [CORNER.NW, CORNER.SW],
    [CORNER.NE, CORNER.SE],
  ], // N
  [
    [CORNER.NE, CORNER.NW],
    [CORNER.SE, CORNER.SW],
  ], // E
  [
    [CORNER.SW, CORNER.NW],
    [CORNER.SE, CORNER.NE],
  ], // S
  [
    [CORNER.NW, CORNER.NE],
    [CORNER.SW, CORNER.SE],
  ], // W
]

/**
 * Corner tilesets (blob/marching-squares style terrain, e.g. grass):
 * there's no single feature per side — each of the 4 corners is
 * independently "on" or "off" — and two tiles touching edge-to-edge
 * share TWO corners along that edge, both of which must agree, or the
 * corner shading would visibly clash right at the seam.
 */
function buildCornerCompat(tiles: Tile[]): number[][][] {
  const has = (tile: Tile, bit: number) => (tile.mask & bit) !== 0

  return tiles.map((a) =>
    SHARED_CORNERS.map((pairs) =>
      tiles
        .map((b, j) => (pairs.every(([ca, cb]) => has(a, ca) === has(b, cb)) ? j : -1))
        .filter((j) => j !== -1),
    ),
  )
}

export function buildBitmaskCompat(tiles: Tile[], type: TilesetType): number[][][] {
  return type === 'corner' ? buildCornerCompat(tiles) : buildEdgeCompat(tiles)
}
