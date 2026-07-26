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
  /** caps how many times each tile may be placed in the whole grid —
   *  unlike weight (relative likelihood per pick), this is an exact
   *  supply. undefined/missing entries are unlimited. */
  counts?: (number | undefined)[]
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
  /** remaining supply per tile this attempt — reset() re-derives it from
   *  opts.counts each time, since supply consumed by a failed attempt
   *  shouldn't carry over into the retry */
  private remaining: number[] = []

  constructor(
    private weights: number[],
    private compat: number[][][],
    private opts: WFCOptions,
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
    this.remaining = Array.from({ length: n }, (_, t) => this.opts.counts?.[t] ?? Infinity)
    // A tile with count 0, or weight <=0, must never be placed at all —
    // not just deprioritized. Without this, weight only ever affects the
    // explicit weighted pick in collapse(); propagate() eliminates purely
    // by edge-compatibility with no idea what "weight" even means, so if
    // a cell's neighbors leave a weight-0 tile as the *only* remaining
    // compatible option (e.g. it's the sole tile with connections on all
    // 4 sides), propagation forces it in anyway. Exhausting both cases
    // up front removes them from every cell before any picks happen, so
    // there's never a "last option" for propagation to fall back on.
    for (let t = 0; t < n; t++) if (this.remaining[t] <= 0 || this.weights[t] <= 0) this.exhaustTile(t)
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
   *  nudge so ties don't all resolve in scan order. A weight of 0 means
   *  "never pick this tile" and must be excluded from the sum outright —
   *  Math.log(0) is -Infinity, and 0 * -Infinity is NaN, which would
   *  silently poison every cell's entropy (since NaN < anything is
   *  false, no cell would ever be picked, and the solver would report
   *  success having resolved nothing). If every remaining option for a
   *  cell is weight <=0 there's no valid tile left for it at all — surface
   *  that immediately as the lowest possible entropy so collapse() gets a
   *  chance to report the contradiction, instead of leaving it undetected. */
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
        if (w <= 0) continue
        sumW += w
        sumWLogW += w * Math.log(w)
      }
      const entropy = sumW > 0 ? Math.log(sumW) - sumWLogW / sumW + this.rng() * 1e-6 : -Infinity
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
    // floating-point edge case: r can fail to cross to <=0 by the last
    // possible tile if that tile has weight 0 (subtracting 0 never moves
    // r) — fall back to the last possible tile that actually has weight,
    // never a weight-0 one
    if (chosen === -1) {
      for (let t = this.weights.length - 1; t >= 0; t--) {
        if (cell.possible[t] && this.weights[t] > 0) {
          chosen = t
          break
        }
      }
    }

    for (let t = 0; t < this.weights.length; t++) cell.possible[t] = t === chosen
    cell.count = 1
    this.queue.push(idx)
    return this.onResolved(idx)
  }

  /** a cell can land on exactly one tile two ways: an explicit weighted
   *  pick in collapse(), or as a side effect of propagate() eliminating
   *  every other option. Both must count against that tile's supply the
   *  same way, or a capped tile can slip past its count entirely via the
   *  propagation path — charge the supply here, in the one place both
   *  paths funnel through. */
  private onResolved(idx: number): boolean {
    const tile = this.cells[idx].possible.indexOf(true)
    if (!Number.isFinite(this.remaining[tile])) return true
    this.remaining[tile]--
    if (this.remaining[tile] <= 0) return this.exhaustTile(tile)
    return true
  }

  /** forcibly removes a tile from every still-undecided cell's options
   *  because its supply has run out (a hard cap, unlike weight, which
   *  only ever affects likelihood) — returns false if that leaves any
   *  cell with zero options left (a contradiction). Removing it can
   *  itself resolve another cell down to one tile, so that cascades
   *  through onResolved() too. */
  private exhaustTile(t: number): boolean {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i]
      if (cell.count <= 1 || !cell.possible[t]) continue
      cell.possible[t] = false
      cell.count--
      if (cell.count === 0) return false
      this.queue.push(i)
      if (cell.count === 1 && !this.onResolved(i)) return false
    }
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
        if (changed) {
          this.queue.push(nIdx)
          if (neighbor.count === 1 && !this.onResolved(nIdx)) return false
        }
      }
    }
    return true
  }
}
