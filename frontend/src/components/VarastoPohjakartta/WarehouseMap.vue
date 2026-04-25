<script setup>
//Tekoälyn tuottama
import { markRaw, nextTick, onMounted, ref, computed, provide, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import CabinetNode    from './CabinetNode.vue'
import BackgroundNode from './BackgroundNode.vue'
import { Warehouse } from 'lucide-vue-next'
import { getCabinets, getCabinetShelves } from '@/api/cabinets.js'
import { getShelfItems } from '@/api/shelves.js'

// ╔══════════════════════════════════════════════════════════════════╗
// ║  CONFIG — only touch this block                                 ║
// ╠══════════════════════════════════════════════════════════════════╣

const MAP_WIDTH   = 1755
const MAP_HEIGHT  = 2482

const INITIAL_ZOOM = null
const INITIAL_PAN  = { x: 0, y: 0 }

const MAX_ZOOM    = 2
const DETAIL_ZOOM = 0.5
const CULL_PAD    = 300

// ╚══════════════════════════════════════════════════════════════════╝

const NODE_W = 52
const NODE_H = 52

const nodeTypes = {
  cabinet:    markRaw(CabinetNode),
  background: markRaw(BackgroundNode),
}

const props = defineProps({
  highlightCabinetId: { type: Number, default: null },
  mapSrc: { type: String, default: '/images/warehouse-map.jpg' },
})

const containerRef   = ref(null)
const minZoom        = ref(0.1)
const viewport       = ref({ x: 0, y: 0, zoom: 0 })
const placedCabinets = ref([])
const shelvesCache   = ref({})
const itemsCache     = ref({})
const isLoading      = ref(true)

const {
  setNodes,
  setEdges,
  onViewportChange,
  setViewport,
} = useVueFlow()

// ─── Cabinet bus ──────────────────────────────────────────────────
const cabinetRegistry = new Map()

provide('cabinetBus', {
  register(id, closeFn) { cabinetRegistry.set(id, closeFn) },
  closeOthers(exceptId) {
    cabinetRegistry.forEach((closeFn, id) => {
      if (id !== exceptId) closeFn()
    })
  },
})

// ─── Clamp pan to map bounds ──────────────────────────────────────
function clampPan(x, y, zoom) {
  if (!containerRef.value) return { x, y }
  const { width, height } = containerRef.value.getBoundingClientRect()

  const scaledW = MAP_WIDTH  * zoom
  const scaledH = MAP_HEIGHT * zoom

  const minX = scaledW < width  ? (width  - scaledW) / 2 : Math.min(0, width  - scaledW)
  const maxX = scaledW < width  ? (width  - scaledW) / 2 : 0
  const minY = scaledH < height ? (height - scaledH) / 2 : Math.min(0, height - scaledH)
  const maxY = scaledH < height ? (height - scaledH) / 2 : 0

  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}

// ─── Load cabinets ────────────────────────────────────────────────
async function loadCabinets() {
  isLoading.value = true
  try {
    const res = await getCabinets({ mapped: true })
    if (Array.isArray(res)) {
      placedCabinets.value = res
    } else if (Array.isArray(res?.data)) {
      placedCabinets.value = res.data
    } else {
      placedCabinets.value = []
    }
  } catch (e) {
    console.error('WarehouseMap: kaappien lataus epäonnistui', e)
    placedCabinets.value = []
  } finally {
    isLoading.value = false
  }
}

// ─── Lazy-load shelves ────────────────────────────────────────────
async function ensureShelves(cabinetId) {
  if (shelvesCache.value[cabinetId]) return
  try {
    const res  = await getCabinetShelves(cabinetId)
    const rows = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
    shelvesCache.value = {
      ...shelvesCache.value,
      [cabinetId]: rows.map(s => ({
        id:        s.id,
        label:     s.number,
        itemCount: s.itemCount ?? s.item_count ?? 0,
        items:     [],
      })),
    }
    setNodes(buildNodes())
  } catch (e) {
    console.error('WarehouseMap: hyllyjen lataus epäonnistui kaapille', cabinetId, e)
  }
}

// ─── Lazy-load items ──────────────────────────────────────────────
async function ensureItems(shelfId) {
  if (itemsCache.value[shelfId]) return
  try {
    const res  = await getShelfItems(shelfId, { limit: 200 })
    const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
    itemsCache.value = {
      ...itemsCache.value,
      [shelfId]: rows.map(i => ({
        id:           i.id,
        name:         i.name,
        note:         i.note,
        tag:          i.tag,
        productGroup: i.productGroup ? { name: i.productGroup } : null,
      })),
    }
    setNodes(buildNodes())
  } catch (e) {
    console.error('WarehouseMap: tuotteiden lataus epäonnistui hyllylle', shelfId, e)
  }
}

// ─── Culling ──────────────────────────────────────────────────────
const visibleRect = computed(() => {
  const { x, y, zoom } = viewport.value
  if (!containerRef.value) return null
  const rect = containerRef.value.getBoundingClientRect()
  return {
    left:   (-x / zoom) - CULL_PAD,
    top:    (-y / zoom) - CULL_PAD,
    right:  (-x / zoom) + (rect.width  / zoom) + CULL_PAD,
    bottom: (-y / zoom) + (rect.height / zoom) + CULL_PAD,
  }
})

function inView(pos) {
  const vr = visibleRect.value
  if (!vr) return true
  return (
    pos.x + NODE_W >= vr.left && pos.x <= vr.right &&
    pos.y + NODE_H >= vr.top  && pos.y <= vr.bottom
  )
}

// ─── Build nodes ──────────────────────────────────────────────────
function buildNodes() {
  const bg = {
    id:       `background-${props.mapSrc}`,
    type:     'background',
    position: { x: 0, y: 0 },
    draggable: false, selectable: false, connectable: false,
    data: { src: props.mapSrc, width: MAP_WIDTH, height: MAP_HEIGHT },
  }

  const belowThreshold = viewport.value.zoom < DETAIL_ZOOM

  const cabinets = placedCabinets.value
    .filter(c => c.map_x !== null && c.map_y !== null)
    .filter(c => {
      if (props.highlightCabinetId && c.id === props.highlightCabinetId) return true
      if (belowThreshold) return false
      return inView({ x: c.map_x, y: c.map_y })
    })
    .map(c => ({
      id:       `cabinet-${c.id}`,
      type:     'cabinet',
      position: { x: c.map_x, y: c.map_y },
      draggable: false,
      data: {
        label:       c.number,
        warehouse:   c.varasto_nimi,
        cabinetId:   c.id,
        color:       c.color || '#2563eb',
        shelfCount:  c.shelfCount ?? c.shelf_count ?? 0,
        highlighted: props.highlightCabinetId === c.id,
        shelves: (shelvesCache.value[c.id] ?? []).map(s => ({
          ...s,
          items:        itemsCache.value[s.id] ?? [],
          onOpenShelf: () => ensureItems(s.id),
        })),
        onOpen: () => ensureShelves(c.id),
      },
    }))

  return [bg, ...cabinets]
}

// ─── Init ─────────────────────────────────────────────────────────
onMounted(async () => {
  const rect = containerRef.value.getBoundingClientRect()

  let initZ, initX, initY
  if (INITIAL_ZOOM === null) {
    initZ = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT)
    initX = (rect.width  - MAP_WIDTH  * initZ) / 2
    initY = (rect.height - MAP_HEIGHT * initZ) / 2
  } else {
    initZ = Math.max(minZoom.value, Math.min(INITIAL_ZOOM, MAX_ZOOM))
    initX = -INITIAL_PAN.x * initZ
    initY = -INITIAL_PAN.y * initZ
  }

  minZoom.value = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT)

  const clamped = clampPan(initX, initY, initZ)
  viewport.value = { x: clamped.x, y: clamped.y, zoom: initZ }

  await loadCabinets()

  if (props.highlightCabinetId) {
    await ensureShelves(props.highlightCabinetId)
  }

  setNodes(buildNodes())
  setEdges([])

  nextTick(() => {
    if (props.highlightCabinetId) {
      zoomToHighlight(props.highlightCabinetId)
    } else {
      setViewport({ x: clamped.x, y: clamped.y, zoom: initZ })
    }
  })
})

// ─── Watch highlight ──────────────────────────────────────────────
watch(() => props.highlightCabinetId, async (id) => {
  if (!id) return
  await ensureShelves(id)
  setNodes(buildNodes())
  await nextTick()
  zoomToHighlight(id)
}, { immediate: true })

function zoomToHighlight(id) {
  const cab = placedCabinets.value.find(c => c.id === id)
  if (!cab || cab.map_x === null || cab.map_y === null) return
  if (!containerRef.value) return

  const rect       = containerRef.value.getBoundingClientRect()
  const targetZoom = Math.max(DETAIL_ZOOM + 0.3, 0.9)

  const rawX = rect.width  / 2 - cab.map_x * targetZoom
  const rawY = rect.height / 2 - cab.map_y * targetZoom
  const { x, y } = clampPan(rawX, rawY, targetZoom)

  setViewport({ x, y, zoom: targetZoom })
  viewport.value = { x, y, zoom: targetZoom }
}

// ─── Viewport change ──────────────────────────────────────────────
onViewportChange(({ zoom, x, y }) => {
  const { x: cx, y: cy } = clampPan(x, y, zoom)
  const needsClamp = Math.abs(x - cx) > 0.5 || Math.abs(y - cy) > 0.5

  if (needsClamp) {
    setViewport({ x: cx, y: cy, zoom })
    viewport.value = { x: cx, y: cy, zoom }
  } else {
    viewport.value = { x, y, zoom }
  }

  setNodes(buildNodes())
})
</script>

<template>
  <div class="map-wrap" ref="containerRef">
    <div class="map-toolbar">
      <div class="map-toolbar-left">
        <div class="map-toolbar-icon">
          <Warehouse :size="14" />
        </div>
        <span class="map-toolbar-title">Varastokartta</span>
      </div>
      <div class="map-toolbar-right">
        <div v-if="isLoading" class="map-loading-dot" aria-label="Ladataan" />
        <span class="map-toolbar-hint">Zoomaa sisään nähdäksesi kaapit</span>
      </div>
    </div>

    <VueFlow
      :node-types="nodeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :min-zoom="minZoom"
      :max-zoom="MAX_ZOOM"
      class="map-canvas"
    >
      <template #node-cabinet="nodeProps">
        <CabinetNode
          v-bind="nodeProps"
          :zoom="viewport.zoom"
          :detail-zoom="nodeProps.data.highlighted ? 0 : DETAIL_ZOOM"
        />
      </template>
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
.map-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 600px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-background-secondary);
}

.map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-primary);
}

.map-toolbar-left,
.map-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-toolbar-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-toolbar-title {
  font-size: 13px;
  font-weight: 500;
}

.map-toolbar-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.map-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.map-canvas {
  flex: 1;
  width: 100%;
}

:deep(.vue-flow__node) {
  overflow: visible !important;
}

:deep(.vue-flow__node:has(.tile--selected)) {
  z-index: 1000 !important;
}
</style>