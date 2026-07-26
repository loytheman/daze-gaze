import type { Tile } from '../tileset'

// N, E, S, W — same convention as WaveFunctionCollapse.ts. Bit values
// match TileDef.mask: N=1, E=2, S=4, W=8.
const BITS = [1, 2, 4, 8]
const OPPOSITE = [2, 3, 0, 1]

/**
 * Two tiles can sit next to each other only if their connecting feature
 * (road, path, edge, whatever the tileset draws) either passes cleanly
 * through their shared edge or is absent on both sides — a tile with a
 * connection facing direction d needs its neighbor in that direction to
 * have a matching connection facing back (the opposite direction),
 * otherwise it would just dead-end into a tile with nothing to meet it.
 */
export function buildBitmaskCompat(tiles: Tile[]): number[][][] {
  const has = (tile: Tile, d: number) => (tile.mask & BITS[d]) !== 0

  return tiles.map((a) =>
    BITS.map((_, d) => {
      const opposite = OPPOSITE[d]
      return tiles
        .map((b, j) => (has(a, d) === has(b, opposite) ? j : -1))
        .filter((j) => j !== -1)
    }),
  )
}
