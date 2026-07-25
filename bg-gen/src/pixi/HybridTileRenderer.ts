import { Texture } from 'pixi.js'
import { canvasFromPixels } from '../wfc/loadImagePixels'
import type { HybridOrientedTile } from '../wfc/hybridEdges'

/** builds one texture per oriented tile directly from its (possibly
 *  rotated) pixel buffer — no GPU render pass needed, unlike
 *  RealTileRenderer's rotation baking, since we already have the raw
 *  rotated bytes from edge detection */
export function buildHybridTileTextures(tiles: HybridOrientedTile[]): Texture[] {
  return tiles.map((t) => {
    const canvas = canvasFromPixels(t.size, t.size, t.pixels)
    const texture = Texture.from(canvas)
    // scaleMode alone won't refresh an already-uploaded GPU sampler;
    // style.update() forces it (see RealTileRenderer.ts's setNearest)
    texture.source.scaleMode = 'nearest'
    texture.source.style.update()
    return texture
  })
}
