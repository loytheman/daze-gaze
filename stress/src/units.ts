import rawUnits from '../data/units.json'

export interface UnitDef {
  type: string
  cat: 'NORMAL' | 'ENEMY' | 'NON_CITY'
  desc: string
  sprite: string
  spriteSmall: string
  stripWidth: number
  idleClip: string | null
  walkClip: string | null
}

export type UnitType = UnitDef['type']

export const UNITS = rawUnits as UnitDef[]

export const UNIT_BY_TYPE: Record<string, UnitDef> = Object.fromEntries(
  UNITS.map((u) => [u.type, u]),
)

/** walk-cycle strip sheets — vertical strips of square frames, sliced at
 *  runtime by sliceVerticalFrames(). Only unit types with a strip here can
 *  animate a walk cycle; the rest just use their static idle sprite. */
export const WALK_STRIPS: Partial<Record<UnitType, string>> = {
  MONKEY: 'unit/monkey/animate_monkey.png',
  GATHERER: 'unit/monkey/animate_gatherer.png',
  HUNTER: 'unit/monkey/animate_hunter.png',
  WOODCUTTER: 'unit/monkey/animate_woodcutter.png',
  STONECUTTER: 'unit/monkey/animate_stonecutter.png',
  ORE_MINER: 'unit/monkey/animate_ore_miner.png',
  TOOL_MAKER: 'unit/monkey/animate_tool_maker.png',
  SPEAR_MONKEY: 'unit/monkey/animate_spearman.png',
  ARCHER: 'unit/monkey/animate_archer.png',
  STICK_INSECT: 'unit/monster/animate_stick_insect.png',
  STONE_BEATLE: 'unit/monster/animate_beatle.png',
  WOLF: 'unit/monster/animate_wolf.png',
  DEVIL_FROG: 'unit/monster/animate_frog.png',
  WILD_BOAR: 'unit/monster/animate_boar.png',
  BEAR: 'unit/monster/animate_bear.png',
  WOOLLY_RHINO: 'unit/monster/animate_rhino.png',
  MAMMOTH: 'unit/monster/animate_mammoth.png',
}

/** unit types we can actually spawn as wandering actors: must exist in
 *  units.json (for the idle sprite) and have a walk strip above */
export const WANDER_TYPES: UnitType[] = Object.keys(WALK_STRIPS).filter(
  (t) => UNIT_BY_TYPE[t],
)
