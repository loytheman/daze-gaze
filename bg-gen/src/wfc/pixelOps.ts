/** a cheap, collision-safe-enough-for-our-purposes hash of a pixel
 *  buffer, used to dedupe identical tiles/patterns. Deliberately not
 *  `String.fromCharCode(...buffer)` — spreading a large typed array into
 *  call arguments blows the stack once buffers get into the tens of
 *  thousands of bytes (e.g. a 400×400 tile is 640,000 bytes). */
export function hashPixels(p: Uint8ClampedArray): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < p.length; i++) {
    h1 = Math.imul(h1 ^ p[i], 2654435761)
    h2 = Math.imul(h2 ^ p[i], 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
}

/** rotates an N×N RGBA buffer 90° clockwise */
export function rotateSquare(p: Uint8ClampedArray, N: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const si = ((N - 1 - x) * N + y) * 4
      const di = (y * N + x) * 4
      out[di] = p[si]
      out[di + 1] = p[si + 1]
      out[di + 2] = p[si + 2]
      out[di + 3] = p[si + 3]
    }
  }
  return out
}

/** mirrors an N×N RGBA buffer left-right */
export function reflectSquare(p: Uint8ClampedArray, N: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const si = (y * N + (N - 1 - x)) * 4
      const di = (y * N + x) * 4
      out[di] = p[si]
      out[di + 1] = p[si + 1]
      out[di + 2] = p[si + 2]
      out[di + 3] = p[si + 3]
    }
  }
  return out
}
