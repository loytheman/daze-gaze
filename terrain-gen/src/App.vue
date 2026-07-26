<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Application, Graphics, Sprite } from 'pixi.js'
import { loadTileset } from './tileset'
import { buildBitmaskCompat } from './wfc/bitmaskCompat'
import { WaveFunctionCollapse } from './wfc/WaveFunctionCollapse'

const STAGE_WIDTH = 1024
const STAGE_HEIGHT = 768
const TILESET_NAME = 'grass4'

const stageEl = ref<HTMLDivElement | null>(null)
let app: Application | null = null

onMounted(async () => {
  if (!stageEl.value) return

  app = new Application()
  await app.init({ width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: 0x2b2f36 })
  stageEl.value.appendChild(app.canvas)

  const { tileSize, type, tiles } = await loadTileset(TILESET_NAME)
  const compat = buildBitmaskCompat(tiles, type)
  const weights = tiles.map((t) => t.weight)
  const counts = tiles.map((t) => t.count ?? undefined)

  const cols = STAGE_WIDTH / tileSize
  const rows = STAGE_HEIGHT / tileSize
  const wfc = new WaveFunctionCollapse(weights, compat, { width: cols, height: rows, wrap: false, counts })
  if (!wfc.run()) throw new Error('WFC failed to find a solution')

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tileIndex = wfc.tileAt(x, y)
      if (tileIndex === null) continue
      const sprite = new Sprite(tiles[tileIndex].texture)
      sprite.position.set(x * tileSize, y * tileSize)
      app.stage.addChild(sprite)
    }
  }

  // debug overlay: outline every tile cell so boundaries are visible
  const borders = new Graphics()
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      borders.rect(x * tileSize, y * tileSize, tileSize, tileSize)
    }
  }
  borders.stroke({ width: 1, color: 0x000000, alpha: 0.3 })
  app.stage.addChild(borders)
})

onBeforeUnmount(() => {
  app?.destroy(true, { children: true, texture: true })
  app = null
})
</script>

<template>
  <div
    ref="stageEl"
    class="shadow-2xl"
    :style="{ width: `${STAGE_WIDTH}px`, height: `${STAGE_HEIGHT}px` }"
  ></div>
</template>
