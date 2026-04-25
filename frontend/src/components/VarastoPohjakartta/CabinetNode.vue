<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Handle, Position } from '@vue-flow/core'
import { Package, ChevronRight, ExternalLink } from 'lucide-vue-next'

//Tekoälyn tuottama
const props = defineProps({
  data:       { type: Object,  required: true },
  zoom:       { type: Number,  default: 1 },
  detailZoom: { type: Number,  default: 0.5 },
  editMode:   { type: Boolean, default: false },
})

const router  = useRouter()
const rootRef  = ref(null)
const flipLeft = ref(false)

const detailed = computed(() => props.zoom >= props.detailZoom)

const cabinetBus = inject('cabinetBus', null)

const selected      = ref(false)
const openShelves   = ref(new Set())
const shelvesLoaded = ref(false)
const loadedShelves = ref(new Set())

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  return { r, g, b }
}

function darkenColor(hex, amount = 20) {
  const { r, g, b } = hexToRgb(hex)
  const clamp = v => Math.max(0, Math.min(255, v - amount))
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

const kaappiVari = computed(() => props.data.color || '#2563eb')
const kaappiVariTumma = computed(() => darkenColor(kaappiVari.value, 25))
const kaappiVariAktiivinen = computed(() => darkenColor(kaappiVari.value, 50))

const nodeStyle = computed(() => ({
  '--cab-color': kaappiVari.value,
  '--cab-color-dark': kaappiVariTumma.value,
  '--cab-color-active': kaappiVariAktiivinen.value,
}))

watch(selected, (open) => {
  const wrapper = rootRef.value?.closest('.vue-flow__node')
  if (wrapper) {
    wrapper.style.zIndex = open ? '1000' : '1'
    wrapper.style.setProperty('z-index', open ? '1000' : '1', 'important')
  }
})

onMounted(() => {
  cabinetBus?.register(props.data.cabinetId, () => {
    selected.value = false
  })
})

function openCabinet() {
  if (props.editMode) return
  const opening = !selected.value
  if (opening) {
    cabinetBus?.closeOthers(props.data.cabinetId)
    if (rootRef.value) {
      const rect = rootRef.value.getBoundingClientRect()
      flipLeft.value = rect.left + 200 > window.innerWidth - 20
    }
    selected.value = true
    if (!shelvesLoaded.value) {
      shelvesLoaded.value = true
      props.data.onOpen?.()
    }
  } else {
    selected.value = false
  }
}

function toggleShelf(shelf) {
  const id = shelf.id
  const next = new Set(openShelves.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
    if (!loadedShelves.value.has(id)) {
      loadedShelves.value = new Set([...loadedShelves.value, id])
      shelf.onOpenShelf?.()
    }
  }
  openShelves.value = next
}

function clickItem(item) {
  router.push(`/items/${item.id}`)
}

const shelfCount = computed(() =>
  props.data.shelfCount ?? props.data.shelves?.length ?? 0
)

const shortLabel = computed(() =>
  props.data.label?.replace(/^kaappi\s*/i, '') ?? props.data.label
)
</script>

<template>
  <div ref="rootRef" :style="nodeStyle">
    <Handle type="target" :position="Position.Top"    style="opacity:0;pointer-events:none" />
    <Handle type="source" :position="Position.Bottom" style="opacity:0;pointer-events:none" />

    <div
      v-if="!detailed"
      class="dot"
      :class="{ 'dot--sel': selected, 'dot--highlight': data.highlighted }"
      :style="editMode ? { cursor: 'grab' } : {}"
      @click.stop="openCabinet()"
    >
      <span class="dot-label">{{ shortLabel }}</span>
    </div>

    <div
      v-else
      class="tile"
      :class="{ 'tile--selected': selected, 'tile--highlight': data.highlighted, 'tile--flip': flipLeft }"
      :style="editMode ? { cursor: 'grab' } : {}"
      @click.stop="openCabinet()"
    >
      <div class="tile-top">
        <span class="tile-short">{{ shortLabel }}</span>
        <span class="tile-count">{{ shelfCount }}</span>
        <span v-if="editMode && data._pending" class="edit-dot edit-dot--pending" title="Tallentamaton" />
        <span v-if="editMode && data._saved"   class="edit-dot edit-dot--saved"   title="Tallennettu" />
      </div>

      <div v-if="selected" class="tile-panel" @click.stop @mousedown.stop @pointerdown.stop>
        <div class="panel-head">
          <button class="panel-link" @click.stop="router.push(`/cabinets/${data.cabinetId}`)">
            <ExternalLink :size="9" />
          </button>
          <span class="panel-title">{{ data.label }}</span>
          <span class="panel-sub">{{ data.warehouse }}</span>
        </div>

        <div class="panel-shelves">
          <template v-if="data.shelves?.length">
            <div v-for="shelf in data.shelves" :key="shelf.id" class="shelf">
              <button class="shelf-row" @click.stop="toggleShelf(shelf)">
                <ChevronRight
                  :size="8" class="chevron"
                  :class="{ 'chevron--open': openShelves.has(shelf.id) }"
                />
                <span class="shelf-label">{{ shelf.label }}</span>
                <span class="shelf-count">{{ shelf.itemCount ?? shelf.items?.length ?? 0 }}</span>
              </button>
              <div v-if="openShelves.has(shelf.id)" class="items">
                <template v-if="shelf.items?.length">
                  <button
                    v-for="item in shelf.items"
                    :key="item.id"
                    class="item-row"
                    @click.stop="clickItem(item)"
                  >
                    <Package :size="8" class="item-icon" />
                    <span class="item-name">{{ item.name }}</span>
                    <span v-if="item.tag" class="item-tag">{{ item.tag }}</span>
                  </button>
                </template>
                <div v-else class="empty">Tyhjä</div>
              </div>
            </div>
          </template>
          <div v-else class="empty">Ei hyllyjä</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dot {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: var(--cab-color);
  border: 1px solid var(--cab-color-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.dot:hover  { background: var(--cab-color-dark); }
.dot--sel   { background: var(--cab-color-active); border-color: var(--cab-color-dark); }
.dot-label  { font-size: 7px; font-weight: 700; color: #fff; letter-spacing: 0.01em; line-height: 1; }

.tile {
  width: 52px;
  background: var(--cab-color);
  border: 1px solid var(--cab-color-dark);
  border-radius: 7px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, width 0.18s ease, box-shadow 0.12s;
  box-shadow: 0 1px 5px rgba(0,0,0,0.15);
  overflow: visible;
  position: relative;
}
.tile:hover:not(.tile--selected) {
  background: var(--cab-color-dark);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.tile--selected {
  background: var(--cab-color-active);
  border-color: var(--cab-color-dark);
  width: 190px;
  cursor: default;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 7px 5px;
  gap: 3px;
}
.tile-short {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  line-height: 1;
}
.tile-count {
  font-size: 8px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.12);
  border-radius: 20px;
  padding: 1px 4px;
  flex-shrink: 0;
  line-height: 1.4;
}

.tile-panel {
  background: #fff;
  border-top: 1px solid rgba(255,255,255,0.14);
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 6px 8px 4px;
  border-bottom: 0.5px solid #e2e8f0;
  gap: 4px;
}
.panel-title { font-size: 10px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.panel-sub   { font-size: 8px; color: #94a3b8; flex-shrink: 0; }

.panel-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 0.5px solid #e2e8f0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.1s, color 0.1s;
}
.panel-link:hover { background: #f1f5f9; color: #334155; }

.panel-shelves { padding: 3px; display: flex; flex-direction: column; gap: 1px; }

.shelf-row {
  display: flex; align-items: center; gap: 3px;
  width: 100%; padding: 3px 5px;
  background: transparent; border: none; border-radius: 4px;
  cursor: pointer; transition: background 0.1s;
}
.shelf-row:hover { background: #f1f5f9; }

.shelf-label { font-size: 9px; font-weight: 500; color: #334155; flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shelf-count { font-size: 8px; color: #94a3b8; background: #f1f5f9; border: 0.5px solid #e2e8f0; border-radius: 20px; padding: 0 3px; flex-shrink: 0; }

.chevron { color: #94a3b8; transition: transform 0.12s ease; flex-shrink: 0; }
.chevron--open { transform: rotate(90deg); }

.items { display: flex; flex-direction: column; gap: 1px; padding: 1px 2px 2px 14px; }

.item-row {
  display: flex; align-items: center; gap: 3px;
  width: 100%; padding: 2px 5px;
  border-radius: 3px; border: 0.5px solid transparent;
  background: transparent; cursor: pointer; text-align: left;
  transition: background 0.1s, border-color 0.1s;
}
.item-row:hover { background: #f1f5f9; border-color: #e2e8f0; }
.item-row:active { opacity: 0.7; }

.item-icon { color: #94a3b8; flex-shrink: 0; }
.item-name { font-size: 9px; color: #1e293b; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-tag  { font-size: 8px; color: #64748b; border: 0.5px solid #e2e8f0; border-radius: 20px; padding: 0 3px; flex-shrink: 0; }

.empty { font-size: 8px; color: #94a3b8; padding: 3px 6px; }

.edit-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.edit-dot--pending { background: #f59e0b; }
.edit-dot--saved   { background: #22c55e; }

.tile--flip.tile--selected { direction: rtl; }
.tile--flip .tile-top,
.tile--flip .tile-panel { direction: ltr; }

/* ── Highlight — pulsing yellow glow ring ── */
.dot--highlight {
  outline: 3px solid #fff;
  outline-offset: 2px;
  box-shadow:
    0 0 0 5px rgba(168, 85, 247, 0.8),
    0 0 16px 4px rgba(139, 92, 246, 0.5);
  animation: cab-pulse 1.4s ease-in-out infinite;
}

.tile--highlight {
  outline: 3px solid #fff;
  outline-offset: 2px;
  box-shadow:
    0 0 0 5px rgba(168, 85, 247, 0.8),
    0 0 20px 6px rgba(139, 92, 246, 0.5);
}
</style>