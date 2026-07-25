import { Application, Container, Sprite, Texture } from 'pixi.js'
import { buildRealOrientedTiles } from '../wfc/realTileset'
import { WaveFunctionCollapse, type Heuristic } from '../wfc/WaveFunctionCollapse'
import { buildRealTileTextures } from './RealTileRenderer'
import { TILESETS, isEdgeSpecTileset } from '../wfc/tilesetRegistry'
import { buildEdgeSpecOrientedTiles } from '../wfc/edgeSpecTileset'
import { buildEdgeSpecTileTextures } from './EdgeSpecTileRenderer'
import { OVERLAPPING_IMAGES } from '../wfc/overlappingRegistry'
import { loadImagePixels } from '../wfc/loadImagePixels'
import { extractPatterns, buildOverlappingCompat, type OverlappingOptions } from '../wfc/overlappingModel'
import { HYBRID_SETS, loadHybridSetImages } from '../wfc/hybridRegistry'
import { buildHybridOrientedTiles, type HybridOptions } from '../wfc/hybridEdges'
import { buildHybridTileTextures } from './HybridTileRenderer'
import { buildTiledModel2Tiles } from '../wfc/tiledModel2'
import { TILED_MODEL_2_SETS } from '../wfc/tiledModel2Assets'
import { buildTiledModel2Textures } from './TiledModel2Renderer'

export type GridSource =
  | { kind: 'tileset'; name: string }
  | { kind: 'overlapping'; imageName: string; options: OverlappingOptions }
  | { kind: 'hybrid'; setName: string; options: HybridOptions }
  | { kind: 'tiled2'; setName: string }

interface BuiltSource {
  weights: number[]
  compat: number[][][]
  textures: Texture[]
  /** per-tile tint (hex) applied over `textures` — used by the overlapping
   *  model, which shares one white texture and colors it per pattern */
  tints: number[] | null
}

export interface GridOptions {
  cols: number
  rows: number
  tileSize: number
  wrap: boolean
  /** cells collapsed per animation frame — higher solves faster but skips
   *  the step-by-step reveal */
  stepsPerFrame: number
  source: GridSource
  /** 'entropy' (default) fills the most-constrained cells first;
   *  'scanline' collapses strictly in raster order, matching mxgmn's own
   *  heuristic for tilesets like Castle that were authored/demoed with it —
   *  see WaveFunctionCollapse.ts's Heuristic doc comment */
  heuristic?: Heuristic
}

const PLACEHOLDER_TINT = 0x2c3b28
const MAX_ATTEMPTS = 50

/** owns the Pixi Application and animates a WaveFunctionCollapse solve:
 *  every frame it advances the solver a few cells and paints whichever
 *  cells just resolved, so the grid visibly fills in over time. */
export class BackgroundGrid {
  app = new Application()
  /** surfaced when a tileset fails to load, e.g. a bad image path */
  onError: ((message: string) => void) | null = null
  private layer = new Container()
  private sprites: Sprite[] = []
  private textures: Texture[] = []
  private tints: number[] | null = null
  private wfc: WaveFunctionCollapse | null = null
  private opts: GridOptions
  private running = false
  private attemptsLeft = MAX_ATTEMPTS
  /** bumped on every rebuild() so a slow in-flight load can tell it's
   *  been superseded and bail out instead of clobbering newer state */
  private generation = 0

  constructor(opts: GridOptions) {
    this.opts = opts
  }

  static availableTilesets(): string[] {
    return TILESETS.map((t) => t.name)
  }

  static availableOverlappingImages(): string[] {
    return OVERLAPPING_IMAGES.map((i) => i.name)
  }

  static availableHybridSets(): string[] {
    return HYBRID_SETS.map((s) => s.name)
  }

  static availableTiledModel2Sets(): string[] {
    return TILED_MODEL_2_SETS
  }

  async mount(el: HTMLElement): Promise<void> {
    await this.app.init({ resizeTo: el, backgroundColor: 0x161a14, antialias: false, roundPixels: true })
    el.appendChild(this.app.canvas)
    this.app.stage.addChild(this.layer)
    this.app.ticker.add(this.tick)
    await this.rebuild(this.opts)
  }

  /** tears down the current grid and starts a fresh generation, optionally
   *  with new dimensions/tile size/source */
  async rebuild(opts: GridOptions): Promise<void> {
    const generation = ++this.generation
    this.running = false
    this.opts = opts

    let built: BuiltSource
    try {
      built = await this.buildSource(opts)
    } catch (err) {
      this.onError?.(err instanceof Error ? err.message : String(err))
      return
    }
    if (generation !== this.generation) return // superseded by a newer rebuild

    this.wfc = new WaveFunctionCollapse(built.weights, built.compat, {
      width: opts.cols,
      height: opts.rows,
      wrap: opts.wrap,
      heuristic: opts.heuristic,
    })
    this.textures = built.textures
    this.tints = built.tints

    for (const s of this.sprites) s.destroy()
    this.layer.removeChildren()
    this.sprites = Array.from({ length: opts.cols * opts.rows }, (_, i) => {
      const sprite = new Sprite(Texture.WHITE)
      sprite.tint = PLACEHOLDER_TINT
      sprite.width = opts.tileSize
      sprite.height = opts.tileSize
      sprite.position.set((i % opts.cols) * opts.tileSize, Math.floor(i / opts.cols) * opts.tileSize)
      this.layer.addChild(sprite)
      return sprite
    })

    this.attemptsLeft = MAX_ATTEMPTS
    this.running = true
  }

  private async buildSource(opts: GridOptions): Promise<BuiltSource> {
    const source = opts.source

    if (source.kind === 'tileset') {
      const entry = TILESETS.find((t) => t.name === source.name)
      if (!entry) throw new Error(`unknown tileset: ${source.name}`)

      if (isEdgeSpecTileset(entry.json)) {
        const { tiles, compat } = buildEdgeSpecOrientedTiles(entry.json)
        const textures = await buildEdgeSpecTileTextures(entry.name, tiles)
        return { weights: tiles.map((t) => t.weight), compat, textures, tints: null }
      }

      const { tiles, compat } = buildRealOrientedTiles(entry.json)
      const textures = await buildRealTileTextures(this.app.renderer, entry.name, entry.json.unique ?? false, tiles)
      return { weights: tiles.map((t) => t.weight), compat, textures, tints: null }
    }

    if (source.kind === 'overlapping') {
      const entry = OVERLAPPING_IMAGES.find((i) => i.name === source.imageName)
      if (!entry) throw new Error(`unknown overlapping image: ${source.imageName}`)
      const image = await loadImagePixels(entry.url)
      const patterns = extractPatterns(image, source.options)
      if (patterns.length === 0) throw new Error(`no patterns extracted from ${source.imageName}`)
      const compat = buildOverlappingCompat(patterns, source.options.patternSize)
      return {
        weights: patterns.map((p) => p.weight),
        compat,
        textures: patterns.map(() => Texture.WHITE),
        tints: patterns.map((p) => (p.color[0] << 16) | (p.color[1] << 8) | p.color[2]),
      }
    }

    if (source.kind === 'hybrid') {
      const entry = HYBRID_SETS.find((s) => s.name === source.setName)
      if (!entry) throw new Error(`unknown hybrid tile set: ${source.setName}`)
      const images = await loadHybridSetImages(entry)
      const { tiles, compat } = buildHybridOrientedTiles(images, source.options)
      return { weights: tiles.map((t) => t.weight), compat, textures: buildHybridTileTextures(tiles), tints: null }
    }

    if (!TILED_MODEL_2_SETS.includes(source.setName)) throw new Error(`unknown tiled-2 set: ${source.setName}`)
    const { tiles, compat } = buildTiledModel2Tiles()
    const textures = await buildTiledModel2Textures(tiles, source.setName)
    return { weights: tiles.map(() => 1), compat, textures, tints: null }
  }

  private tick = (): void => {
    if (!this.running || !this.wfc) return
    const wfc = this.wfc

    for (let i = 0; i < this.opts.stepsPerFrame; i++) {
      if (wfc.done) {
        this.running = false
        break
      }
      if (wfc.step()) continue

      this.attemptsLeft--
      if (this.attemptsLeft <= 0) {
        this.running = false
        break
      }
      wfc.reset()
      for (const s of this.sprites) s.tint = PLACEHOLDER_TINT
    }

    for (const idx of wfc.takeResolved()) this.applyTile(idx)
  }

  private applyTile(idx: number): void {
    if (!this.wfc) return
    const x = idx % this.opts.cols
    const y = Math.floor(idx / this.opts.cols)
    const tileIdx = this.wfc.tileAt(x, y)
    if (tileIdx === null) return
    const texture = this.textures[tileIdx]
    if (!texture) return
    const sprite = this.sprites[idx]
    sprite.texture = texture
    sprite.tint = this.tints ? this.tints[tileIdx] : 0xffffff
  }

  destroy(): void {
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true, texture: false })
  }
}
