import { Assets, Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js'
import type { RealOrientedTile } from '../wfc/realTileset'

// every PNG under src/assets/tilesets, keyed by its project-root-relative
// path — resolved eagerly (cheap: just URL strings, not the image bytes)
const TILE_IMAGE_URLS = import.meta.glob('/src/assets/tilesets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function imageUrl(tilesetName: string, fileName: string): string {
  const key = `/src/assets/tilesets/${tilesetName}/${fileName}.png`
  const url = TILE_IMAGE_URLS[key]
  if (!url) throw new Error(`missing tileset image: ${key}`)
  return url
}

/** mutating `texture.source.scaleMode` alone doesn't invalidate the GPU
 *  sampler for a texture that's cached/already been uploaded (Pixi only
 *  refreshes it on `style.update()`) — without this, images reloaded
 *  across regenerations can silently keep rendering blurry/linear */
function setNearest(texture: Texture): void {
  texture.source.scaleMode = 'nearest'
  texture.source.style.update()
}

/** loads (and, for tilesets without a separate image per rotation, bakes
 *  rotated copies of) one texture per oriented tile — the returned array
 *  is parallel to `tiles`, so index i is that oriented tile's texture */
export async function buildRealTileTextures(
  renderer: Renderer,
  tilesetName: string,
  unique: boolean,
  tiles: RealOrientedTile[],
): Promise<Texture[]> {
  if (unique) {
    return Promise.all(
      tiles.map(async (t) => {
        const texture = await Assets.load(imageUrl(tilesetName, `${t.name} ${t.orientation}`))
        setNearest(texture)
        return texture as Texture
      }),
    )
  }

  const baseNames = [...new Set(tiles.map((t) => t.name))]
  const baseTextures = new Map<string, Texture>()
  await Promise.all(
    baseNames.map(async (name) => {
      const texture = await Assets.load(imageUrl(tilesetName, name))
      setNearest(texture)
      baseTextures.set(name, texture)
    }),
  )

  return tiles.map((t) => {
    const base = baseTextures.get(t.name)!
    if (t.orientation === 0) return base

    const sprite = new Sprite(base)
    sprite.anchor.set(0.5)
    sprite.position.set(base.width / 2, base.height / 2)
    sprite.rotation = (t.orientation * Math.PI) / 2
    const holder = new Container()
    holder.addChild(sprite)

    const baked = renderer.generateTexture({ target: holder, frame: new Rectangle(0, 0, base.width, base.height) })
    setNearest(baked)
    holder.destroy({ children: true })
    return baked
  })
}
