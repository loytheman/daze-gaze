import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import gsap from 'gsap'
import { WALK_STRIPS, type UnitType } from '../units'
import { PX, spriteUrl } from './constants'

const WALK_FPS = 10

/** slices a vertical strip of square frames (walk cycles, the pointer
 *  animation) into individual Textures sharing the strip's source */
function sliceVerticalFrames(base: Texture): Texture[] {
  const size = base.width
  const count = Math.floor(base.height / size)
  const frames: Texture[] = []
  for (let i = 0; i < count; i++) {
    frames.push(new Texture({
      source: base.source,
      frame: new Rectangle(0, i * size, size, size),
    }))
  }
  return frames
}

async function walkFrames(type: UnitType): Promise<Texture[] | null> {
  const path = WALK_STRIPS[type]
  if (!path) return null
  const base: Texture = await Assets.load(spriteUrl(path))
  return sliceVerticalFrames(base)
}

export class CharacterActor {
  sprite = new Sprite()
  private frames: Texture[] | null = null
  private idleTexture!: Texture
  private state: 'idle' | 'walk' = 'idle'
  private stateLeft = 1 + Math.random() * 3
  private frameTime = 0
  private frameIdx = 0
  private dir = Math.random() < 0.5 ? -1 : 1
  private speed = 26 + Math.random() * 14
  /** true while walkIn()'s entrance tween is running — update() just cycles
   *  walk frames in place instead of its usual idle/wander state machine,
   *  since the gsap tween (not this class) owns sprite.x for that stretch */
  private entering = false
  homeX = 0
  homeY = 0

  constructor(private wanderRange: number) {
    this.sprite.anchor.set(0.5, 1)
    this.sprite.scale.set(PX)
  }

  async init(type: UnitType, idlePath: string): Promise<void> {
    this.idleTexture = await Assets.load(spriteUrl(idlePath))
    this.frames = await walkFrames(type)
    this.sprite.texture = this.idleTexture
  }

  /** slides in from fromY down to homeY (already set by the caller), playing
   *  the walk cycle — used when a unit's actor is first created, instead of
   *  it just popping into place. x is pinned at homeX for the whole descent */
  walkIn(fromY: number, duration = 2.5): void {
    this.sprite.position.set(this.homeX, fromY)
    this.sprite.scale.x = this.dir < 0 ? -PX : PX
    this.entering = true
    gsap.to(this.sprite, {
      pixi: { y: this.homeY }, duration, ease: 'linear',
      onComplete: () => {
        this.entering = false
        this.state = 'idle'
        this.stateLeft = 1.5 + Math.random() * 3.5
        this.sprite.texture = this.idleTexture
        this.frameIdx = 0
      },
    })
  }

  update(dtSec: number): void {
    // keep draw order in sync with depth: units lower on screen (larger y)
    // render on top of units further up
    this.sprite.zIndex = this.sprite.y

    if (this.entering) {
      if (this.frames) {
        this.frameTime += dtSec
        if (this.frameTime >= 1 / WALK_FPS) {
          this.frameTime = 0
          this.frameIdx = (this.frameIdx + 1) % this.frames.length
          this.sprite.texture = this.frames[this.frameIdx]
        }
      }
      return
    }
    this.stateLeft -= dtSec
    if (this.stateLeft <= 0) {
      if (this.state === 'idle' && this.frames) {
        this.state = 'walk'
        this.stateLeft = 0.8 + Math.random() * 2
        this.dir = Math.random() < 0.5 ? -1 : 1
      } else {
        this.state = 'idle'
        this.stateLeft = 1.5 + Math.random() * 3.5
        this.sprite.texture = this.idleTexture
        this.frameIdx = 0
      }
    }

    if (this.state === 'walk' && this.frames) {
      const next = this.sprite.x + this.dir * this.speed * dtSec
      if (Math.abs(next - this.homeX) > this.wanderRange) {
        this.dir *= -1
      } else {
        this.sprite.x = next
      }
      this.sprite.scale.x = this.dir < 0 ? -PX : PX
      this.frameTime += dtSec
      if (this.frameTime >= 1 / WALK_FPS) {
        this.frameTime = 0
        this.frameIdx = (this.frameIdx + 1) % this.frames.length
        this.sprite.texture = this.frames[this.frameIdx]
      }
    }
  }
}
