import { Application, Container, Sprite, Texture } from 'pixi.js'
import { buildOrientedTiles } from '../wfc/tileset'
import { WaveFunctionCollapse } from '../wfc/WaveFunctionCollapse'
import { buildTileTextures } from './TileRenderer'

export interface GridOptions {
  cols: number
  rows: number
  tileSize: number
  wrap: boolean
  /** cells collapsed per animation frame — higher solves faster but skips
   *  the step-by-step reveal */
  stepsPerFrame: number
}

const PLACEHOLDER_TINT = 0x2c3b28
const MAX_ATTEMPTS = 50

/** owns the Pixi Application and animates a WaveFunctionCollapse solve:
 *  every frame it advances the solver a few cells and paints whichever
 *  cells just resolved, so the grid visibly fills in over time */
export class BackgroundGrid {
  app = new Application()
  private layer = new Container()
  private sprites: Sprite[] = []
  private textures = new Map<string, Texture>()
  private wfc: WaveFunctionCollapse | null = null
  private opts: GridOptions
  private running = false
  private attemptsLeft = MAX_ATTEMPTS

  constructor(opts: GridOptions) {
    this.opts = opts
  }

  async mount(el: HTMLElement): Promise<void> {
    await this.app.init({ resizeTo: el, backgroundColor: 0x161a14, antialias: false, roundPixels: true })
    el.appendChild(this.app.canvas)
    this.app.stage.addChild(this.layer)
    this.app.ticker.add(this.tick)
    this.rebuild(this.opts)
  }

  /** tears down the current grid and starts a fresh generation, optionally
   *  with new dimensions/tile size */
  rebuild(opts: GridOptions): void {
    this.opts = opts
    const tiles = buildOrientedTiles()
    this.wfc = new WaveFunctionCollapse(tiles, { width: opts.cols, height: opts.rows, wrap: opts.wrap })
    this.textures = buildTileTextures(
      this.app.renderer,
      tiles.map((t) => t.edges),
      opts.tileSize,
    )

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
    const tile = this.wfc.tileAt(x, y)
    if (!tile) return
    const texture = this.textures.get(tile.edges.join(''))
    if (!texture) return
    const sprite = this.sprites[idx]
    sprite.texture = texture
    sprite.tint = 0xffffff
  }

  destroy(): void {
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true, texture: false })
  }
}
