<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { BackgroundGrid, type GridOptions } from './pixi/BackgroundGrid'

const stageEl = ref<HTMLDivElement | null>(null)
const tileSize = ref(32)
const wrap = ref(true)
const stepsPerFrame = ref(8)

let grid: BackgroundGrid | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function currentOptions(): GridOptions {
  const el = stageEl.value
  const cols = Math.max(1, Math.ceil((el?.clientWidth ?? 800) / tileSize.value))
  const rows = Math.max(1, Math.ceil((el?.clientHeight ?? 600) / tileSize.value))
  return { cols, rows, tileSize: tileSize.value, wrap: wrap.value, stepsPerFrame: stepsPerFrame.value }
}

function regenerate() {
  grid?.rebuild(currentOptions())
}

function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(regenerate, 200)
}

onMounted(async () => {
  if (!stageEl.value) return
  grid = new BackgroundGrid(currentOptions())
  await grid.mount(stageEl.value)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeTimer) clearTimeout(resizeTimer)
  grid?.destroy()
  grid = null
})
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-neutral-900">
    <div ref="stageEl" class="h-full w-full"></div>

    <div
      class="absolute left-3 top-3 flex flex-wrap items-end gap-4 rounded-lg bg-black/60 px-4 py-3 text-xs text-neutral-200 backdrop-blur-sm"
    >
      <label class="flex flex-col gap-1">
        Tile size
        <input
          v-model.number="tileSize"
          type="number"
          min="8"
          max="128"
          step="4"
          class="w-20 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
        />
      </label>

      <label class="flex flex-col gap-1">
        Speed
        <input v-model.number="stepsPerFrame" type="range" min="1" max="60" class="w-28" />
      </label>

      <label class="flex items-center gap-2 pb-1">
        <input v-model="wrap" type="checkbox" class="h-3.5 w-3.5" />
        Seamless wrap
      </label>

      <button
        class="rounded-md border border-emerald-700 bg-emerald-800 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
        @click="regenerate"
      >
        Generate
      </button>
    </div>
  </div>
</template>
