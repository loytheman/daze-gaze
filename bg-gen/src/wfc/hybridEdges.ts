import type { PixelImage } from './loadImagePixels'
import { rotateSquare, hashPixels } from './pixelOps'

// N, E, S, W — same convention as WaveFunctionCollapse.ts
const OPPOSITE = [2, 3, 0, 1]

export interface HybridOptions {
  rotations: boolean
  /** how many pixel rows/cols deep to compare along each edge */
  edgeDepth: number
  /** max per-channel (0-255) difference still counted as a match, so
   *  near-identical (but not byte-identical) edges can still connect */
  tolerance: number
}

export interface HybridOrientedTile {
  name: string
  orientation: number
  pixels: Uint8ClampedArray
  size: number
  weight: number
}

/** extracts a thin strip along one side of a square tile, always scanned
 *  in the same absolute direction (N/S left-to-right, E/W top-to-bottom)
 *  so two facing edges can be compared position-for-position */
function extractEdge(pixels: Uint8ClampedArray, size: number, dir: number, depth: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * depth * 4)
  for (let d = 0; d < depth; d++) {
    for (let k = 0; k < size; k++) {
      let x: number
      let y: number
      if (dir === 0) {
        x = k
        y = d
      } else if (dir === 2) {
        x = k
        y = size - 1 - d
      } else if (dir === 1) {
        x = size - 1 - d
        y = k
      } else {
        x = d
        y = k
      }
      const si = (y * size + x) * 4
      const di = (d * size + k) * 4
      out[di] = pixels[si]
      out[di + 1] = pixels[si + 1]
      out[di + 2] = pixels[si + 2]
      out[di + 3] = pixels[si + 3]
    }
  }
  return out
}

function edgesMatch(a: Uint8ClampedArray, b: Uint8ClampedArray, tolerance: number): boolean {
  for (let i = 0; i < a.length; i += 4) {
    if (
      Math.abs(a[i] - b[i]) > tolerance ||
      Math.abs(a[i + 1] - b[i + 1]) > tolerance ||
      Math.abs(a[i + 2] - b[i + 2]) > tolerance
    ) {
      return false
    }
  }
  return true
}

/**
 * Auto-detects tile adjacency from the tile art itself, instead of
 * relying on hand-authored rules: for every pair of (optionally rotated)
 * tiles, it slices a thin strip off the touching edges and fuzzy-matches
 * them pixel-by-pixel. Two tiles are compatible neighbors in a direction
 * when the strips that would touch are close enough. Ported from the
 * Edge/Tile.analyze approach in the bundled hybrid-model p5.js reference.
 *
 * Requires every input image to be the same size (square tiles).
 */
export function buildHybridOrientedTiles(
  images: { name: string; image: PixelImage }[],
  opts: HybridOptions,
): { tiles: HybridOrientedTile[]; compat: number[][][] } {
  if (images.length === 0) throw new Error('no tile images to analyze')
  const size = images[0].image.width
  for (const { name, image } of images) {
    if (image.width !== size || image.height !== size) {
      throw new Error(`hybrid model requires uniform square tiles: "${name}" is ${image.width}x${image.height}, expected ${size}x${size}`)
    }
  }

  const byKey = new Map<string, HybridOrientedTile>()
  for (const { name, image } of images) {
    const orientationCount = opts.rotations ? 4 : 1
    let pixels = image.data
    for (let o = 0; o < orientationCount; o++) {
      if (o > 0) pixels = rotateSquare(pixels, size)
      const key = hashPixels(pixels)
      const existing = byKey.get(key)
      if (existing) {
        existing.weight++
        continue
      }
      byKey.set(key, { name, orientation: o, pixels, size, weight: 1 })
    }
  }
  const tiles = [...byKey.values()]

  const edges = tiles.map((t) => [0, 1, 2, 3].map((dir) => extractEdge(t.pixels, size, dir, opts.edgeDepth)))

  const compat: number[][][] = tiles.map(() => [[], [], [], []])
  for (let i = 0; i < tiles.length; i++) {
    for (let j = 0; j < tiles.length; j++) {
      for (let dir = 0; dir < 4; dir++) {
        if (edgesMatch(edges[i][dir], edges[j][OPPOSITE[dir]], opts.tolerance)) {
          compat[i][dir].push(j)
        }
      }
    }
  }

  return { tiles, compat }
}
