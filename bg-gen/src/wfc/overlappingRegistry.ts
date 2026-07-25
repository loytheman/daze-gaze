const modules = import.meta.glob('/src/assets/overlapping/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export interface OverlappingImageEntry {
  name: string
  url: string
}

/** every sample image under src/assets/overlapping, e.g. "Skyline" -> its
 *  resolved asset URL */
export const OVERLAPPING_IMAGES: OverlappingImageEntry[] = Object.entries(modules)
  .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.png$/, ''), url }))
  .sort((a, b) => a.name.localeCompare(b.name))
