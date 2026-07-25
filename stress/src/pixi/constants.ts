/** integer scale applied to the (tiny, 30–64px) source sprites so they read
 *  clearly on screen */
export const PX = 1

export function spriteUrl(path: string): string {
  return `/assets/${path}`
}
