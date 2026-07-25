import type { TilesetJson } from './realTileset'
import type { EdgeSpecTilesetJson } from './edgeSpecTileset'

const modules = import.meta.glob('/src/assets/tilesets/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, TilesetJson | EdgeSpecTilesetJson>

export interface TilesetEntry {
  name: string
  json: TilesetJson | EdgeSpecTilesetJson
}

/** every tileset JSON under src/assets/tilesets, e.g. "Circuit" -> its
 *  parsed content — either the old mxgmn symmetry+neighbor-rules shape
 *  or the newer derived-edges shape (see isEdgeSpecTileset) */
export const TILESETS: TilesetEntry[] = Object.entries(modules)
  .map(([path, json]) => ({ name: path.split('/').pop()!.replace(/\.json$/, ''), json }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** the new format (produced by scripts/derive_tile_edges.py) carries an
 *  explicit `edges` signature per tile instead of `symmetry` + top-level
 *  `neighbors` rules */
export function isEdgeSpecTileset(json: TilesetJson | EdgeSpecTilesetJson): json is EdgeSpecTilesetJson {
  return 'edges' in json.tiles[0]
}
