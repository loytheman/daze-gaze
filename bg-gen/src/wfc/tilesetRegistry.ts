import type { TilesetJson } from './realTileset'

const modules = import.meta.glob('/src/assets/tilesets/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, TilesetJson>

export interface TilesetEntry {
  name: string
  json: TilesetJson
}

/** every tileset JSON under src/assets/tilesets, e.g. "Circuit" -> its
 *  parsed tiles/neighbors/subsets */
export const TILESETS: TilesetEntry[] = Object.entries(modules)
  .map(([path, json]) => ({ name: path.split('/').pop()!.replace(/\.json$/, ''), json }))
  .sort((a, b) => a.name.localeCompare(b.name))
