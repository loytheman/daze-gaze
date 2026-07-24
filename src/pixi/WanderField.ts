import { Application, Assets, Container, TilingSprite } from 'pixi.js'
import { CharacterActor } from './CharacterActor'
import { UNIT_BY_TYPE, WANDER_TYPES, type UnitType } from '../units'
import { spriteUrl } from './constants'

/** owns the Pixi Application and the pool of wandering CharacterActors —
 *  kept independent of Vue so it can be driven from a single ref in the
 *  component and torn down cleanly on unmount */
export class WanderField {
  app = new Application()
  /** fired when the player clicks the one red-tinted unit in the field */
  onFoundRed: (() => void) | null = null
  private ground!: TilingSprite
  private layer = new Container()
  private actors: CharacterActor[] = []
  private ready = false

  async mount(el: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: el,
      backgroundColor: 0x3a7d44,
      antialias: false,
      roundPixels: true,
    })
    el.appendChild(this.app.canvas)

    const groundTexture = await Assets.load(spriteUrl('environment/ground_grass.png'))
    groundTexture.source.scaleMode = 'nearest'
    this.ground = new TilingSprite({
      texture: groundTexture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    })
    this.app.stage.addChild(this.ground)
    this.app.renderer.on('resize', (w: number, h: number) => {
      this.ground.width = w
      this.ground.height = h
    })

    this.layer.sortableChildren = true
    this.app.stage.addChild(this.layer)
    this.app.ticker.add((ticker) => {
      const dtSec = ticker.deltaMS / 1000
      for (const actor of this.actors) actor.update(dtSec)
    })
    this.ready = true
  }

  get fps(): number {
    return this.app.ticker.FPS
  }

  get count(): number {
    return this.actors.length
  }

  private clear(): void {
    for (const actor of this.actors) {
      this.layer.removeChild(actor.sprite)
      actor.sprite.destroy()
    }
    this.actors = []
  }

  /** tears down the current population and spawns `total` fresh units,
   *  each a random type from WANDER_TYPES, walking down from above the top
   *  of the screen to a random home position within the ground band */
  async spawn(total: number): Promise<void> {
    if (!this.ready) return
    this.clear()
    const w = this.app.screen.width
    const groundTop = this.app.screen.height * 0.35
    const groundBottom = this.app.screen.height * 0.95

    const redIndex = total > 0 ? Math.floor(Math.random() * total) : -1

    const jobs: Promise<void>[] = []
    for (let i = 0; i < total; i++) {
      const type = WANDER_TYPES[
        Math.floor(Math.random() * WANDER_TYPES.length)
      ] as UnitType
      const def = UNIT_BY_TYPE[type]
      const wanderRange = 40 + Math.random() * 110
      const actor = new CharacterActor(wanderRange)
      const homeX = wanderRange + Math.random() * Math.max(1, w - wanderRange * 2)
      const homeY = groundTop + Math.random() * (groundBottom - groundTop)
      actor.homeX = homeX
      actor.homeY = homeY
      if (i === redIndex) {
        actor.sprite.tint = 0xff2020
        actor.sprite.eventMode = 'static'
        actor.sprite.cursor = 'pointer'
        actor.sprite.on('pointertap', () => this.onFoundRed?.())
      }
      this.actors.push(actor)
      this.layer.addChild(actor.sprite)

      const job = actor.init(type, def.spriteSmall).then(() => {
        const fromY = -60 - Math.random() * 200
        actor.walkIn(fromY, 20 + Math.random() * 20)
      })
      jobs.push(job)
    }
    await Promise.all(jobs)
  }

  destroy(): void {
    this.clear()
    this.app.destroy(true, { children: true, texture: false })
  }
}
