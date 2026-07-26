import type { Direction, RoadTile } from '../roadTileset'

// N, E, S, W — same convention as WaveFunctionCollapse.ts
const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W']
const OPPOSITE = [2, 3, 0, 1]

/**
 * Two road tiles can sit next to each other only if the road either
 * passes cleanly through their shared edge or is absent on both sides —
 * a tile with a connection facing direction d needs its neighbor in that
 * direction to have a matching connection facing back (the opposite
 * direction), otherwise the road would just dead-end into plain grass.
 */
export function buildRoadCompat(tiles: RoadTile[]): number[][][] {
  const has = (tile: RoadTile, dir: Direction) => tile.connections.includes(dir)

  return tiles.map((a) =>
    DIRECTIONS.map((dir, d) => {
      const opposite = DIRECTIONS[OPPOSITE[d]]
      return tiles
        .map((b, j) => (has(a, dir) === has(b, opposite) ? j : -1))
        .filter((j) => j !== -1)
    }),
  )
}
