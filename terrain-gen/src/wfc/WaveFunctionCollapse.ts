// N, E, S, W
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

interface Cell {
  possible: boolean[]
  count: number
}

export interface WFCOptions {
  width: number
  height: number
  /** tile edges wrap around the grid, so the output tiles seamlessly */
  wrap: boolean
  rng?: () => number
}

/**
 * Simple tiled-model Wave Function Collapse: repeatedly collapses the
 * lowest-entropy cell to a single tile (weighted-random among what's
 * still possible there) and propagates the resulting edge constraints to
 * its neighbors, until every cell holds exactly one tile or a cell runs
 * out of options (a contradiction — call reset() and try again).
 *
 * Knows nothing about what a "tile" looks like — callers hand in tile
 * weights and a precomputed [tile][direction] -> allowed-neighbor-tiles
 * table built however suits their tiles (see roadCompat.ts).
 */
export class WaveFunctionCollapse {
  readonly width: number
  readonly height: number
  private wrap: boolean
  private rng: () => number
  private cells: Cell[] = []
  private queue: number[] = []

  constructor(
    private weights: number[],
    private compat: number[][][],
    opts: WFCOptions,
  ) {
    this.width = opts.width
    this.height = opts.height
    this.wrap = opts.wrap
    this.rng = opts.rng ?? Math.random
    this.reset()
  }

  reset(): void {
    const n = this.weights.length
    this.cells = Array.from({ length: this.width * this.height }, () => ({
      possible: new Array(n).fill(true),
      count: n,
    }))
    this.queue = []
  }

  get done(): boolean {
    return this.cells.every((c) => c.count === 1)
  }

  /** the resolved tile index at (x, y), or null while still undecided */
  tileAt(x: number, y: number): number | null {
    const cell = this.cells[y * this.width + x]
    if (cell.count !== 1) return null
    return cell.possible.indexOf(true)
  }

  /** runs to completion, resetting and retrying on contradiction, up to
   *  maxAttempts times. Returns true if it found a full solution. */
  run(maxAttempts = 100): boolean {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.solveOnce()) return true
      this.reset()
    }
    return false
  }

  private solveOnce(): boolean {
    while (!this.done) {
      const idx = this.pickLowestEntropyCell()
      if (idx === -1) break
      if (!this.collapse(idx)) return false
      if (!this.propagate()) return false
    }
    return true
  }

  private neighborIndex(x: number, y: number, d: number): number | null {
    let nx = x + DX[d]
    let ny = y + DY[d]
    if (this.wrap) {
      nx = (nx + this.width) % this.width
      ny = (ny + this.height) % this.height
    } else if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
      return null
    }
    return ny * this.width + nx
  }

  /** Shannon entropy over remaining tile weights, plus a tiny random
   *  nudge so ties don't all resolve in scan order */
  private pickLowestEntropyCell(): number {
    let best = -1
    let bestEntropy = Infinity
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i]
      if (cell.count <= 1) continue
      let sumW = 0
      let sumWLogW = 0
      for (let t = 0; t < this.weights.length; t++) {
        if (!cell.possible[t]) continue
        const w = this.weights[t]
        sumW += w
        sumWLogW += w * Math.log(w)
      }
      const entropy = Math.log(sumW) - sumWLogW / sumW + this.rng() * 1e-6
      if (entropy < bestEntropy) {
        bestEntropy = entropy
        best = i
      }
    }
    return best
  }

  private collapse(idx: number): boolean {
    const cell = this.cells[idx]
    let sumW = 0
    for (let t = 0; t < this.weights.length; t++) if (cell.possible[t]) sumW += this.weights[t]
    if (sumW <= 0) return false

    let r = this.rng() * sumW
    let chosen = -1
    for (let t = 0; t < this.weights.length; t++) {
      if (!cell.possible[t]) continue
      r -= this.weights[t]
      if (r <= 0) {
        chosen = t
        break
      }
    }
    if (chosen === -1) chosen = cell.possible.lastIndexOf(true)

    for (let t = 0; t < this.weights.length; t++) cell.possible[t] = t === chosen
    cell.count = 1
    this.queue.push(idx)
    return true
  }

  private propagate(): boolean {
    while (this.queue.length > 0) {
      const idx = this.queue.pop() as number
      const x = idx % this.width
      const y = Math.floor(idx / this.width)
      const cell = this.cells[idx]

      for (let d = 0; d < 4; d++) {
        const nIdx = this.neighborIndex(x, y, d)
        if (nIdx === null) continue
        const neighbor = this.cells[nIdx]

        const allowed = new Array(this.weights.length).fill(false)
        for (let t = 0; t < this.weights.length; t++) {
          if (!cell.possible[t]) continue
          for (const u of this.compat[t][d]) allowed[u] = true
        }

        let changed = false
        for (let u = 0; u < this.weights.length; u++) {
          if (neighbor.possible[u] && !allowed[u]) {
            neighbor.possible[u] = false
            neighbor.count--
            changed = true
          }
        }
        if (neighbor.count === 0) return false
        if (changed) this.queue.push(nIdx)
      }
    }
    return true
  }
}
