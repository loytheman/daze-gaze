export interface PixelImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** loads an image URL into raw RGBA pixels via an offscreen canvas — used
 *  by the overlapping model, which needs direct pixel access rather than
 *  a GPU texture */
export async function loadImagePixels(url: string): Promise<PixelImage> {
  const img = new Image()
  img.src = url
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(img, 0, 0)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { width: canvas.width, height: canvas.height, data }
}

/** builds a canvas from raw RGBA pixels — used to hand Pixi a `Texture`
 *  for tile art we've transformed (e.g. rotated) in plain JS */
export function canvasFromPixels(width: number, height: number, data: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  // TS's ImageData overload wants a plain-ArrayBuffer-backed array; our
  // buffers always are one, TS just can't see that through the generics
  ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)
  return canvas
}
