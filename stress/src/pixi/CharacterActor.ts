import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import gsap from 'gsap'
import { WALK_STRIPS, type UnitType } from '../units'
import { PX, spriteUrl } from './constants'

const WALK_FPS = 10
/** distance at which a unit starts fleeing the cursor */
const FLEE_RADIUS = 70
/** distance the cursor must clear before a fleeing unit stops running —
 *  wider than FLEE_RADIUS so units don't flicker between states right at
 *  the edge */
const FLEE_CLEAR_RADIUS = 100
const RETURN_SPEED = 70
/** how close to home counts as "arrived" and resumes normal idle/wander */
const RETURN_EPSILON = 3
/** chance that, once the cursor clears out, a unit just settles wherever
 *  it ended up instead of walking back to its original spot */
const STAY_AWAY_CHANCE = 0.5

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
  /** 0 = skittish, 1 = unfazed — drives both how long a unit tolerates the
   *  cursor before bolting and how fast it runs once it does, so the jumpy
   *  ones sprint off immediately and the brave ones amble away late */
  private boldness = Math.random()
  private fleeSpeed = 90 + (1 - this.boldness) * 100 + Math.random() * 20
  /** how long the cursor must linger within FLEE_RADIUS before this unit
   *  bolts — near 0 for skittish units, up to ~1.4s for braver ones */
  private spookDelay = this.boldness * 0.4 + Math.random() * 0.2
  private scareTimer = 0
  /** true while walkIn()'s entrance tween is running — update() just cycles
   *  walk frames in place instead of its usual idle/w;ander state machine,
   *  since the gsap tween (not this class) owns sprite.x for that stretch */
  private entering = false
  private fleeing = false
  private returning = false
  homeX = 0
  homeY = 0
  /** clamp box fleeing is allowed to push the sprite into — set by the
   *  field alongside homeX/homeY */
  bounds = { minX: 0, maxX: Infinity, minY: 0, maxY: Infinity }

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

  private advanceWalkFrame(dtSec: number): void {
    if (!this.frames) return
    this.frameTime += dtSec
    if (this.frameTime >= 1 / WALK_FPS) {
      this.frameTime = 0
      this.frameIdx = (this.frameIdx + 1) % this.frames.length
      this.sprite.texture = this.frames[this.frameIdx]
    }
  }

  private faceDir(dir: number): void {
    this.dir = dir
    this.sprite.scale.x = dir < 0 ? -PX : PX
  }

  update(dtSec: number, cursor: { x: number; y: number } | null): void {
    // keep draw order in sync with depth: units lower on screen (larger y)
    // render on top of units further up
    this.sprite.zIndex = this.sprite.y

    if (this.entering) {
      this.advanceWalkFrame(dtSec)
      return
    }

    const dx = this.sprite.x - (cursor?.x ?? Infinity)
    const dy = this.sprite.y - (cursor?.y ?? Infinity)
    const distSq = dx * dx + dy * dy

    if (this.fleeing) {
      // already running: keep going until the cursor clears the wider radius
      if (!cursor || distSq >= FLEE_CLEAR_RADIUS * FLEE_CLEAR_RADIUS) {
        this.fleeing = false
        if (Math.random() < STAY_AWAY_CHANCE) {
          // settle right here instead of walking back — this spot is home now
          this.homeX = this.sprite.x
          this.homeY = this.sprite.y
          this.state = 'idle'
          this.stateLeft = 1.5 + Math.random() * 3.5
          this.sprite.texture = this.idleTexture
          this.frameIdx = 0
        } else {
          this.returning = true
        }
      }
    } else if (cursor && distSq < FLEE_RADIUS * FLEE_RADIUS) {
      // cursor is close enough to notice — build up spook before bolting
      this.scareTimer += dtSec
      if (this.scareTimer >= this.spookDelay) {
        this.fleeing = true
        this.returning = false
        this.scareTimer = 0
      }
    } else {
      this.scareTimer = 0
    }

    if (this.fleeing) {
      const dist = Math.sqrt(distSq) || 1
      const x = clamp(this.sprite.x + (dx / dist) * this.fleeSpeed * dtSec, this.bounds.minX, this.bounds.maxX)
      const y = clamp(this.sprite.y + (dy / dist) * this.fleeSpeed * dtSec, this.bounds.minY, this.bounds.maxY)
      this.sprite.x = x
      this.sprite.y = y
      this.faceDir(dx < 0 ? -1 : 1)
      this.advanceWalkFrame(dtSec)
      return
    }

    if (this.returning) {
      const rdx = this.homeX - this.sprite.x
      const rdy = this.homeY - this.sprite.y
      const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
      if (rdist < RETURN_EPSILON) {
        this.returning = false
        this.sprite.position.set(this.homeX, this.homeY)
        this.state = 'idle'
        this.stateLeft = 1.5 + Math.random() * 3.5
        this.sprite.texture = this.idleTexture
        this.frameIdx = 0
      } else {
        this.sprite.x += (rdx / rdist) * RETURN_SPEED * dtSec
        this.sprite.y += (rdy / rdist) * RETURN_SPEED * dtSec
        this.faceDir(rdx < 0 ? -1 : 1)
        this.advanceWalkFrame(dtSec)
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
      this.faceDir(this.dir)
      this.advanceWalkFrame(dtSec)
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
