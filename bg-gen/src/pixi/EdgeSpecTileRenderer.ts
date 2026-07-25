import { Texture } from 'pixi.js'
import { loadImagePixels, canvasFromPixels } from '../wfc/loadImagePixels'
import { rotateSquare } from '../wfc/pixelOps'
import type { EdgeSpecOrientedTile } from '../wfc/edgeSpecTileset'

const modules = import.meta.glob('/src/assets/tilesets/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function imageUrl(tilesetName: string, tileName: string): string {
  const key = `/src/assets/tilesets/${tilesetName}/${tileName}.png`
  const url = modules[key]
  if (!url) throw new Error(`missing tileset image: ${key}`)
  return url
}

/** loads each base tile image once, then bakes a rotated texture for
 *  every oriented tile the solver needs, parallel to `tiles`. Uses the
 *  same plain pixel-rotation pipeline as TiledModel2Renderer.ts (not
 *  RealTileRenderer.ts's Pixi-sprite rotation) so the rendered rotation
 *  direction is guaranteed to agree with the one edgeSpecTileset.ts used
 *  to rotate the edge labels — both are `rotateSquare`, so there's no
 *  convention to mismatch. */
export async function buildEdgeSpecTileTextures(tilesetName: string, tiles: EdgeSpecOrientedTile[]): Promise<Texture[]> {
  const baseNames = [...new Set(tiles.map((t) => t.name))]
  const baseImages = new Map<string, Awaited<ReturnType<typeof loadImagePixels>>>()
  await Promise.all(
    baseNames.map(async (name) => {
      baseImages.set(name, await loadImagePixels(imageUrl(tilesetName, name)))
    }),
  )

  return tiles.map((t) => {
    const base = baseImages.get(t.name)!
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
