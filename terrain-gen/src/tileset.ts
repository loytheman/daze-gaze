import { Assets, Texture } from 'pixi.js'

export interface TileDef {
  file: string
  /** bitmask of which sides this tile connects on: N=1, E=2, S=4, W=8 —
   *  e.g. a tile connecting north and east is 1|2=3 */
  mask: number
  weight: number
  /** caps how many times this tile may appear in the whole grid; null/
   *  omitted means unlimited */
  count?: number | null
}

export interface TilesetJson {
  tileSize: number
  tiles: TileDef[]
}

export interface Tile extends TileDef {
  texture: Texture
}

export interface Tileset {
  tileSize: number
  tiles: Tile[]
}

// every tileset manifest under src/assets (road.json, grass.json, ...),
// keyed by its path, and every tile image under their same-named
// subfolder (assets/road/*.png, assets/grass/*.png, ...)
const tilesetJsons = import.meta.glob('./assets/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, TilesetJson>

const imageUrls = import.meta.glob('./assets/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function jsonFor(name: string): TilesetJson {
  const key = `./assets/${name}.json`
  const json = tilesetJsons[key]
  if (!json) throw new Error(`missing tileset json: ${key}`)
  return json
}

function urlFor(name: string, file: string): string {
  const key = `./assets/${name}/${file}`
  const url = imageUrls[key]
  if (!url) throw new Error(`missing tileset image: ${key}`)
  return url
}

/** loads every tile listed in assets/<name>.json (e.g. "road", "grass"),
 *  parallel to its tiles array */
export async function loadTileset(name: string): Promise<Tileset> {
  const json = jsonFor(name)
  const tiles = await Promise.all(
    json.tiles.map(async (def) => ({
      ...def,
      texture: await Assets.load(urlFor(name, def.file)),
    })),
  )
  return { tileSize: json.tileSize, tiles }
}
