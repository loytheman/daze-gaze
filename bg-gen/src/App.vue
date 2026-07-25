<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { BackgroundGrid, type GridOptions, type GridSource } from './pixi/BackgroundGrid'

const PROCEDURAL = '__procedural__'
const TILED = 'tiled'
const TILED2 = 'tiled2'
const OVERLAPPING = 'overlapping'
const HYBRID = 'hybrid'

const stageEl = ref<HTMLDivElement | null>(null)
const tileSize = ref(32)
const wrap = ref(true)
const stepsPerFrame = ref(8)
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const technique = ref(TILED)

// tiled-model options
const sourceName = ref(PROCEDURAL)
const tilesetNames = BackgroundGrid.availableTilesets()

// overlapping-model options
const overlappingImageNames = BackgroundGrid.availableOverlappingImages()
const overlappingImage = ref(overlappingImageNames[0] ?? '')
const patternSize = ref(3)
const patternRotations = ref(false)
const patternReflections = ref(false)

// hybrid-model options
const hybridSetNames = BackgroundGrid.availableHybridSets()
const hybridSet = ref(hybridSetNames[0] ?? '')
const hybridRotations = ref(true)

// tiled-model-2 options
const tiled2SetNames = BackgroundGrid.availableTiledModel2Sets()
const tiled2Set = ref(tiled2SetNames[0] ?? '')

let grid: BackgroundGrid | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function currentSource(): GridSource {
  if (technique.value === TILED2) {
    return { kind: 'tiled2', setName: tiled2Set.value }
  }
  if (technique.value === OVERLAPPING) {
    return {
      kind: 'overlapping',
      imageName: overlappingImage.value,
      options: { patternSize: patternSize.value, rotations: patternRotations.value, reflections: patternReflections.value },
    }
  }
  if (technique.value === HYBRID) {
    return {
      kind: 'hybrid',
      setName: hybridSet.value,
      options: { rotations: hybridRotations.value, edgeDepth: 1, tolerance: 16 },
    }
  }
  return sourceName.value === PROCEDURAL ? { kind: 'procedural' } : { kind: 'tileset', name: sourceName.value }
}

function currentOptions(): GridOptions {
  const el = stageEl.value
  const cols = Math.max(1, Math.ceil((el?.clientWidth ?? 800) / tileSize.value))
  const rows = Math.max(1, Math.ceil((el?.clientHeight ?? 600) / tileSize.value))
  return { cols, rows, tileSize: tileSize.value, wrap: wrap.value, stepsPerFrame: stepsPerFrame.value, source: currentSource() }
}

async function regenerate() {
  if (!grid) return
  loading.value = true
  errorMsg.value = null
  await grid.rebuild(currentOptions())
  loading.value = false
}

function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(regenerate, 200)
}

onMounted(async () => {
  if (!stageEl.value) return
  grid = new BackgroundGrid(currentOptions())
  grid.onError = (message) => {
    errorMsg.value = message
    loading.value = false
  }
  loading.value = true
  await grid.mount(stageEl.value)
  loading.value = false
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
        Technique
        <select
          v-model="technique"
          class="w-32 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
          @change="regenerate"
        >
          <option :value="TILED">Tiled</option>
          <option :value="TILED2">Tiled 2 (Coding Train)</option>
          <option :value="HYBRID">Hybrid (auto edges)</option>
          <option :value="OVERLAPPING">Overlapping</option>
        </select>
      </label>

      <label v-if="technique === TILED" class="flex flex-col gap-1">
        Tileset
        <select
          v-model="sourceName"
          class="w-36 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
          @change="regenerate"
        >
          <option :value="PROCEDURAL">Procedural (grass & paths)</option>
          <option v-for="name in tilesetNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <label v-if="technique === TILED2" class="flex flex-col gap-1">
        Tile set
        <select
          v-model="tiled2Set"
          class="w-36 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
          @change="regenerate"
        >
          <option v-for="name in tiled2SetNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <template v-if="technique === HYBRID">
        <label class="flex flex-col gap-1">
          Tile set
          <select
            v-model="hybridSet"
            class="w-36 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
            @change="regenerate"
          >
            <option v-for="name in hybridSetNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>

        <label class="flex items-center gap-2 pb-1">
          <input v-model="hybridRotations" type="checkbox" class="h-3.5 w-3.5" />
          Rotations
        </label>
      </template>

      <template v-if="technique === OVERLAPPING">
        <label class="flex flex-col gap-1">
          Sample image
          <select
            v-model="overlappingImage"
            class="w-32 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
            @change="regenerate"
          >
            <option v-for="name in overlappingImageNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          Pattern size
          <input
            v-model.number="patternSize"
            type="number"
            min="2"
            max="5"
            class="w-16 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-neutral-100"
          />
        </label>

        <label class="flex items-center gap-2 pb-1">
          <input v-model="patternRotations" type="checkbox" class="h-3.5 w-3.5" />
          Rotations
        </label>

        <label class="flex items-center gap-2 pb-1">
          <input v-model="patternReflections" type="checkbox" class="h-3.5 w-3.5" />
          Reflections
        </label>
      </template>

      <label class="flex flex-col gap-1">
        Tile size
        <input
          v-model.number="tileSize"
          type="number"
          min="4"
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
        class="rounded-md border border-emerald-700 bg-emerald-800 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        :disabled="loading"
        @click="regenerate"
      >
        {{ loading ? 'Loading…' : 'Generate' }}
      </button>
    </div>

    <div
      v-if="errorMsg"
      class="absolute left-3 top-24 max-w-md rounded-lg border border-red-700 bg-red-950/90 px-4 py-2 text-xs text-red-200"
    >
      {{ errorMsg }}
    </div>
  </div>
</template>
