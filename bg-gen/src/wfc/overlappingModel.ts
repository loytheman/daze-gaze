import type { PixelImage } from './loadImagePixels'
import { rotateSquare, reflectSquare, hashPixels } from './pixelOps'

// N, E, S, W — same convention as WaveFunctionCollapse.ts
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

export interface OverlappingOptions {
  /** side length of each square pixel pattern (N×N), typically 2-4 */
  patternSize: number
  rotations: boolean
  reflections: boolean
}

export interface Pattern {
  pixels: Uint8ClampedArray
  weight: number
  /** the pattern's center pixel, used as this cell's rendered color */
  color: [number, number, number, number]
}

function samplePattern(img: PixelImage, N: number, px: number, py: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // sample with wraparound so patterns tile seamlessly at the source image's own edges
      const sx = (px + x) % img.width
      const sy = (py + y) % img.height
      const si = (sy * img.width + sx) * 4
      const di = (y * N + x) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = img.data[si + 3]
    }
  }
  return out
}

/** slides an N×N window over every pixel of the source image (wrapping at
 *  the edges), optionally adding rotated/reflected copies, and dedupes
 *  identical results — duplicates bump that pattern's weight, so common
 *  motifs are more likely to be picked during the solve */
export function extractPatterns(img: PixelImage, opts: OverlappingOptions): Pattern[] {
  const N = opts.patternSize
  const byKey = new Map<string, Pattern>()

  const record = (pixels: Uint8ClampedArray) => {
    const key = hashPixels(pixels)
    const existing = byKey.get(key)
    if (existing) {
      existing.weight++
      return
    }
    const c = (Math.floor(N / 2) * N + Math.floor(N / 2)) * 4
    byKey.set(key, { pixels, weight: 1, color: [pixels[c], pixels[c + 1], pixels[c + 2], pixels[c + 3]] })
  }

  for (let py = 0; py < img.height; py++) {
    for (let px = 0; px < img.width; px++) {
      const base = samplePattern(img, N, px, py)
      const variants = [base]
      if (opts.reflections) variants.push(reflectSquare(base, N))
      if (opts.rotations) {
        for (const start of [...variants]) {
          let cur = start
          for (let r = 0; r < 3; r++) {
            cur = rotateSquare(cur, N)
            variants.push(cur)
          }
        }
      }
      for (const v of variants) record(v)
    }
  }

  return [...byKey.values()]
}

/** does pattern `a` (anchored at the origin) agree with pattern `b`
 *  (anchored at (dx, dy)) over the pixels their footprints share? */
function overlapMatches(a: Uint8ClampedArray, b: Uint8ClampedArray, N: number, dx: number, dy: number): boolean {
  const xStart = Math.max(0, dx)
  const xEnd = Math.min(N, N + dx)
  const yStart = Math.max(0, dy)
  const yEnd = Math.min(N, N + dy)
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const ai = (y * N + x) * 4
      const bi = ((y - dy) * N + (x - dx)) * 4
      if (a[ai] !== b[bi] || a[ai + 1] !== b[bi + 1] || a[ai + 2] !== b[bi + 2] || a[ai + 3] !== b[bi + 3]) {
        return false
      }
    }
  }
  return true
}

/** builds the [pattern][direction] compatibility table by directly
 *  comparing each pair of patterns' overlapping pixels — the overlapping
 *  model's equivalent of tiled-model edge matching, just at pixel
 *  granularity instead of whole-tile granularity */
export function buildOverlappingCompat(patterns: Pattern[], patternSize: number): number[][][] {
  const compat: number[][][] = patterns.map(() => [[], [], [], []])
  for (let i = 0; i < patterns.length; i++) {
    for (let j = 0; j < patterns.length; j++) {
      for (let d = 0; d < 4; d++) {
        if (overlapMatches(patterns[i].pixels, patterns[j].pixels, patternSize, DX[d], DY[d])) {
          compat[i][d].push(j)
        }
      }
    }
  }
  return compat
}
