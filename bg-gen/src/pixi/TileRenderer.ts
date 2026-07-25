import { Graphics, type Renderer, type Texture } from 'pixi.js'
import type { Edges } from '../wfc/types'

const GRASS = 0x5b9c4a
const SPECKLE = 0x4f8a40
const PATH = 0xc9a26b
const PATH_EDGE = 0xa9825a

const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

// fixed relative offsets so the speckle is stable per texture without
// needing real randomness
const SPECKLE_SPOTS = [
  [0.18, 0.22],
  [0.78, 0.16],
  [0.24, 0.78],
  [0.82, 0.8],
]

function drawTile(g: Graphics, edges: Edges, size: number): void {
  g.rect(0, 0, size, size).fill(GRASS)
  for (const [fx, fy] of SPECKLE_SPOTS) {
    g.rect(fx * size - 1, fy * size - 1, 2, 2).fill(SPECKLE)
  }

  if (!edges.includes('P')) return

  const half = size / 2
  const w = size * 0.34
  g.rect(half - w / 2, half - w / 2, w, w).fill(PATH)
  for (let d = 0; d < 4; d++) {
    if (edges[d] !== 'P') continue
    const dx = DX[d]
    const dy = DY[d]
    const x = dx === 0 ? half - w / 2 : dx > 0 ? half : 0
    const y = dy === 0 ? half - w / 2 : dy > 0 ? half : 0
    const rw = dx === 0 ? w : half
    const rh = dy === 0 ? w : half
    g.rect(x, y, rw, rh).fill(PATH)
  }
  g.rect(half - w / 2, half - w / 2, w, w).stroke({ width: 1, color: PATH_EDGE, alpha: 0.5 })
}

/** bakes one texture per unique edge signature — every cell sharing a
 *  pattern reuses the same texture, keyed by e.g. "PGPG" */
export function buildTileTextures(renderer: Renderer, tiles: Edges[], size: number): Map<string, Texture> {
  const textures = new Map<string, Texture>()
  for (const edges of tiles) {
    const key = edges.join('')
    if (textures.has(key)) continue
    const g = new Graphics()
    drawTile(g, edges, size)
    const texture = renderer.generateTexture(g)
    texture.source.scaleMode = 'nearest'
    textures.set(key, texture)
    g.destroy()
  }
  return textures
}
