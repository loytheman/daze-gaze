import { Texture } from 'pixi.js'
import { canvasFromPixels } from '../wfc/loadImagePixels'
import { rotateSquare } from '../wfc/pixelOps'
import { loadTiledModel2BaseImages } from '../wfc/tiledModel2Assets'
import type { TiledModel2Tile } from '../wfc/tiledModel2'

/** loads the chosen set's 13 base tile images once, then bakes a rotated
 *  texture for every oriented tile the solver needs, parallel to `tiles` */
export async function buildTiledModel2Textures(tiles: TiledModel2Tile[], setName: string): Promise<Texture[]> {
  const baseImages = await loadTiledModel2BaseImages(setName)
  return tiles.map((t) => {
    const base = baseImages[t.index]
    let pixels = base.data
    for (let r = 0; r < t.orientation; r++) pixels = rotateSquare(pixels, base.width)
    const canvas = canvasFromPixels(base.width, base.height, pixels)
    const texture = Texture.from(canvas)
    // scaleMode alone won't refresh an already-uploaded GPU sampler;
    // style.update() forces it (see RealTileRenderer.ts's setNearest)
    texture.source.scaleMode = 'nearest'
    texture.source.style.update()
    return texture
  })
}
