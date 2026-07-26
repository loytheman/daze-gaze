import { Assets, Texture } from 'pixi.js'
import roadJson from './assets/road.json'

export type Direction = 'N' | 'E' | 'S' | 'W'

export interface RoadTileDef {
  file: string
  mask: number
  weight: number
  /** caps how many times this tile may appear in the whole grid; null/
   *  omitted means unlimited */
  count?: number | null
  connections: Direction[]
}

export interface RoadTilesetJson {
  tileSize: number
  tiles: RoadTileDef[]
}

export interface RoadTile extends RoadTileDef {
  texture: Texture
}

const json = roadJson as RoadTilesetJson

const imageUrls = import.meta.glob('./assets/road/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function urlFor(file: string): string {
  const key = `./assets/road/${file}`
  const url = imageUrls[key]
  if (!url) throw new Error(`missing road tile image: ${key}`)
  return url
}

export const ROAD_TILE_SIZE = json.tileSize

/** loads every tile listed in road.json, parallel to json.tiles */
export async function loadRoadTiles(): Promise<RoadTile[]> {
  return Promise.all(
    json.tiles.map(async (def) => ({
      ...def,
      texture: await Assets.load(urlFor(def.file)),
    })),
  )
}
