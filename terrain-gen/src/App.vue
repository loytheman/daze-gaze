<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Application, Sprite } from 'pixi.js'
import { loadRoadTiles, ROAD_TILE_SIZE } from './roadTileset'

const STAGE_WIDTH = 1024
const STAGE_HEIGHT = 768
const GRID_COLS = 4
const DISPLAY_SCALE = 3

const stageEl = ref<HTMLDivElement | null>(null)
let app: Application | null = null

onMounted(async () => {
  if (!stageEl.value) return

  app = new Application()
  await app.init({ width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: 0x2b2f36 })
  stageEl.value.appendChild(app.canvas)

  const tiles = await loadRoadTiles()
  const cellSize = ROAD_TILE_SIZE * DISPLAY_SCALE
  const rows = Math.ceil(tiles.length / GRID_COLS)
  const gridWidth = GRID_COLS * cellSize
  const gridHeight = rows * cellSize
  const originX = (STAGE_WIDTH - gridWidth) / 2
  const originY = (STAGE_HEIGHT - gridHeight) / 2

  tiles.forEach((tile, i) => {
    const sprite = new Sprite(tile.texture)
    sprite.width = cellSize
    sprite.height = cellSize
    sprite.position.set(originX + (i % GRID_COLS) * cellSize, originY + Math.floor(i / GRID_COLS) * cellSize)
    app!.stage.addChild(sprite)
  })
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
