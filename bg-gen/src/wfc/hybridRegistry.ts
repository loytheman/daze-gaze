import { loadImagePixels, type PixelImage } from './loadImagePixels'

const hybridModules = import.meta.glob('/src/assets/hybrid/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const tilesetModules = import.meta.glob('/src/assets/tilesets/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export interface HybridSetEntry {
  name: string
  urls: string[]
}

function groupByFolder(modules: Record<string, string>): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const [path, url] of Object.entries(modules)) {
    const parts = path.split('/')
    const folder = parts[parts.length - 2]
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder)!.push(url)
  }
  return map
}

const grouped = new Map([...groupByFolder(hybridModules), ...groupByFolder(tilesetModules)])

/** every folder of tile PNGs under src/assets/hybrid and src/assets/tilesets
 *  — both are usable here since adjacency is auto-detected from pixels,
 *  no rules file needed */
export const HYBRID_SETS: HybridSetEntry[] = [...grouped.entries()]
  .map(([name, urls]) => ({ name, urls: [...urls].sort() }))
  .sort((a, b) => a.name.localeCompare(b.name))

function fileNameOf(url: string): string {
  const last = url.split('/').pop() ?? url
  return decodeURIComponent(last).replace(/\.png(\?.*)?$/, '')
}

export async function loadHybridSetImages(entry: HybridSetEntry): Promise<{ name: string; image: PixelImage }[]> {
  return Promise.all(
    entry.urls.map(async (url) => ({ name: fileNameOf(url), image: await loadImagePixels(url) })),
  )
}
