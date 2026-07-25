import { loadImagePixels, type PixelImage } from './loadImagePixels'

const modules = import.meta.glob('/src/assets/hybrid/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** the only tile sets that share the 13-tile edge topology BASE_EDGES in
 *  tiledModel2.ts was hand-authored for — same shapes, different art */
export const TILED_MODEL_2_SETS = ['circuit-coding-train', 'circuit']

function urlFor(setName: string, index: number): string {
  const key = Object.keys(modules).find((p) => p.endsWith(`/${setName}/${index}.png`))
  if (!key) throw new Error(`missing ${setName} tile image: ${index}.png`)
  return modules[key]
}

/** loads a set's 13 base tile images (0.png..12.png), in index order, to
 *  match BASE_EDGES in tiledModel2.ts */
export async function loadTiledModel2BaseImages(setName: string): Promise<PixelImage[]> {
  const images: PixelImage[] = []
  for (let i = 0; i < 13; i++) images.push(await loadImagePixels(urlFor(setName, i)))
  return images
}
