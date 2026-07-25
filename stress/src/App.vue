<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import './pixi/gsapSetup'
import { WanderField } from './pixi/WanderField'

const stageEl = ref<HTMLDivElement | null>(null)
const unitCount = ref(2000)
const spawning = ref(false)
const fps = ref(0)
const activeCount = ref(0)
const foundRed = ref(false)

let field: WanderField | null = null
let statsTimer: ReturnType<typeof setInterval> | null = null
let foundTimer: ReturnType<typeof setTimeout> | null = null

function dismissFound() {
  if (foundTimer) clearTimeout(foundTimer)
  foundTimer = null
  foundRed.value = false
}

async function respawn() {
  if (!field) return
  dismissFound()
  spawning.value = true
  await field.spawn(unitCount.value)
  spawning.value = false
}

onMounted(async () => {
  if (!stageEl.value) return
  field = new WanderField()
  field.onFoundRed = () => {
    foundRed.value = true
    if (foundTimer) clearTimeout(foundTimer)
    foundTimer = setTimeout(dismissFound, 4000)
  }
  await field.mount(stageEl.value)
  await respawn()

  statsTimer = setInterval(() => {
    if (!field) return
    fps.value = Math.round(field.fps)
    activeCount.value = field.count
  }, 250)
})

onBeforeUnmount(() => {
  if (statsTimer) clearInterval(statsTimer)
  if (foundTimer) clearTimeout(foundTimer)
  field?.destroy()
  field = null
})
</script>

<template>
  <div class="app">
    <div ref="stageEl" class="stage"></div>

    <div class="hud">
      <div class="stat">
        <span class="label">FPS</span>
        <span class="value" :class="{ warn: fps > 0 && fps < 50 }">{{ fps }}</span>
      </div>
      <div class="stat">
        <span class="label">Units</span>
        <span class="value">{{ activeCount }}</span>
      </div>

      <label class="control">
        Unit count
        <input v-model.number="unitCount" type="number" min="1" max="5000" step="10" />
      </label>

      <button class="control" :disabled="spawning" @click="respawn">
        {{ spawning ? 'Spawning…' : 'Respawn' }}
      </button>
    </div>

    <Transition name="pop">
      <div v-if="foundRed" class="congrats" @click="dismissFound">
        🎉 Congratulations! You found the red unit!
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #1c1c1c;
}

.stage {
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  color: #eee;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 42px;
}

.stat .label {
  font-size: 11px;
  opacity: 0.7;
}

.stat .value {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat .value.warn {
  color: #ff6b6b;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  opacity: 0.85;
}

.control input {
  width: 80px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #222;
  color: #eee;
}

button.control {
  justify-content: center;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #557;
  background: #2b3a55;
  color: #eee;
  cursor: pointer;
  font-size: 13px;
}

button.control:disabled {
  opacity: 0.6;
  cursor: default;
}

.congrats {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px 32px;
  background: rgba(20, 20, 20, 0.9);
  border: 2px solid #ffcc33;
  border-radius: 12px;
  color: #ffd966;
  font-family: system-ui, sans-serif;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

.pop-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pop-leave-active {
  transition: opacity 0.2s ease;
}

.pop-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.85);
}

.pop-leave-to {
  opacity: 0;
}
</style>
