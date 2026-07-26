<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Application, Sprite } from 'pixi.js'
import { loadRoadTiles, ROAD_TILE_SIZE } from './roadTileset'
import { buildRoadCompat } from './wfc/roadCompat'
import { WaveFunctionCollapse } from './wfc/WaveFunctionCollapse'

const STAGE_WIDTH = 1024
const STAGE_HEIGHT = 768

const stageEl = ref<HTMLDivElement | null>(null)
let app: Application | null = null

onMounted(async () => {
  if (!stageEl.value) return

  app = new Application()
  await app.init({ width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: 0x2b2f36 })
  stageEl.value.appendChild(app.canvas)

  const tiles = await loadRoadTiles()
  const compat = buildRoadCompat(tiles)
  const weights = tiles.map(() => 1)

  const cols = STAGE_WIDTH / ROAD_TILE_SIZE
  const rows = STAGE_HEIGHT / ROAD_TILE_SIZE
  const wfc = new WaveFunctionCollapse(weights, compat, { width: cols, height: rows, wrap: false })
  if (!wfc.run()) throw new Error('WFC failed to find a solution')

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tileIndex = wfc.tileAt(x, y)
      if (tileIndex === null) continue
      const sprite = new Sprite(tiles[tileIndex].texture)
      sprite.position.set(x * ROAD_TILE_SIZE, y * ROAD_TILE_SIZE)
      app.stage.addChild(sprite)
    }
  }
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
