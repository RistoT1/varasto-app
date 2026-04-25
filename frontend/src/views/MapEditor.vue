<script setup>
//Tekoälyn tuottama
import { ref, computed, markRaw, onMounted, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import {
  Warehouse, Save, Trash2, Move, Eye, EyeOff,
  ChevronDown, Search, X, Check, MapPin, AlertCircle,
  RotateCcw, Palette
} from 'lucide-vue-next'
import CabinetNode    from '@/components/VarastoPohjakartta/CabinetNode.vue'
import BackgroundNode from '@/components/VarastoPohjakartta/BackgroundNode.vue'
import { getCabinets, updateCabinetPosition } from '@/api/cabinets.js'

// ╔══════════════════════════════════════════════════════════════════╗
// ║  CONFIG                                                         ║
// ╚══════════════════════════════════════════════════════════════════╝
const MAP_SRC     = '/images/warehouse-map.jpg'
const MAP_WIDTH   = 1755
const MAP_HEIGHT  = 2482
const MAX_ZOOM    = 2
const DETAIL_ZOOM = 0.5
const CULL_PAD    = 300
const NODE_W      = 52
const NODE_H      = 52
const SNAP_SIZE   = 10

//Valmiit värivaihtoehdot kaapeille
const KAAPPI_VARIT = [
  { nimi: 'Sininen',   arvo: '#2563eb' },
  { nimi: 'Vihreä',    arvo: '#16a34a' },
  { nimi: 'Punainen',  arvo: '#dc2626' },
  { nimi: 'Oranssi',   arvo: '#ea580c' },
  { nimi: 'Violetti',  arvo: '#7c3aed' },
  { nimi: 'Pinkki',    arvo: '#db2777' },
  { nimi: 'Harmaa',    arvo: '#64748b' },
  { nimi: 'Keltainen', arvo: '#ca8a04' },
  { nimi: 'Syaani',    arvo: '#0891b2' },
  { nimi: 'Limetti',   arvo: '#65a30d' },
]

// ─── State ────────────────────────────────────────────────────────
const containerRef = ref(null)
const minZoom      = ref(0.1)
const viewport     = ref({ x: 0, y: 0, zoom: 0 })

const allCabinets  = ref([])
const isLoading    = ref(true)
const isSaving     = ref(false)
const saveQueue    = ref(new Map())
const savedIds     = ref(new Set())
const errors       = ref([])

const sidebarOpen  = ref(true)
const searchQuery  = ref('')
const selectedId   = ref(null)
const showUnplaced = ref(true)

const nodeTypes = {
  cabinet:    markRaw(CabinetNode),
  background: markRaw(BackgroundNode),
}

const {
  setNodes, setEdges, onViewportChange, setViewport,
  onNodeDragStop,
} = useVueFlow()

// ─── Computed ─────────────────────────────────────────────────────
const placedCabinets = computed(() =>
  allCabinets.value.filter(c => c.map_x !== null && c.map_y !== null)
)
const unplacedCabinets = computed(() =>
  allCabinets.value.filter(c => c.map_x === null || c.map_y === null)
)
const filteredUnplaced = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return unplacedCabinets.value.filter(c =>
    c.number.toLowerCase().includes(q) ||
    c.varasto_nimi.toLowerCase().includes(q)
  )
})
const pendingCount = computed(() => saveQueue.value.size)

//Valittu kaappi
const selectedCabinet = computed(() =>
  selectedId.value ? allCabinets.value.find(c => c.id === selectedId.value) : null
)

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
  return pos.x + NODE_W >= vr.left && pos.x <= vr.right &&
         pos.y + NODE_H >= vr.top  && pos.y <= vr.bottom
}

// ─── Build nodes ──────────────────────────────────────────────────
function buildNodes() {
  const bg = {
    id: 'background', type: 'background',
    position: { x: 0, y: 0 },
    draggable: false, selectable: false, connectable: false,
    data: { src: MAP_SRC, width: MAP_WIDTH, height: MAP_HEIGHT },
  }

  if (viewport.value.zoom < DETAIL_ZOOM) return [bg]

  const cabinets = placedCabinets.value
    .filter(c => inView({ x: c.map_x, y: c.map_y }))
    .map(c => ({
      id:       `cabinet-${c.id}`,
      type:     'cabinet',
      position: { x: c.map_x, y: c.map_y },
      draggable: true,
      selected:  selectedId.value === c.id,
      data: {
        label:     c.number,
        warehouse: c.varasto_nimi,
        cabinetId: c.id,
        color:     c.color || '#2563eb',
        shelves:   [],
        _pending:  saveQueue.value.has(c.id),
        _saved:    savedIds.value.has(c.id),
      },
    }))

  return [bg, ...cabinets]
}

// ─── Init ─────────────────────────────────────────────────────────
onMounted(async () => {
  await loadCabinets()

  const rect = containerRef.value.getBoundingClientRect()
  const z    = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT)
  const { x: cx, y: cy } = clampPan(
    (rect.width  - MAP_WIDTH  * z) / 2,
    (rect.height - MAP_HEIGHT * z) / 2,
    z,
  )

  minZoom.value  = z
  viewport.value = { x: cx, y: cy, zoom: z }

  setNodes(buildNodes())
  setEdges([])
  setViewport({ x: cx, y: cy, zoom: z })
})

async function loadCabinets() {
  isLoading.value = true
  try {
    const res = await getCabinets()
    allCabinets.value = Array.isArray(res) ? res : []
  } catch (e) {
    console.error(e)
    errors.value.push('Kaappien lataus epäonnistui')
    allCabinets.value = []
  } finally {
    isLoading.value = false
  }
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

// ─── Drag stop → queue save ───────────────────────────────────────
onNodeDragStop(({ node }) => {
  if (!node.id.startsWith('cabinet-')) return

  const cabinetId = Number(node.id.replace('cabinet-', ''))
  let { x, y } = node.position

  //Snap ruudukkoon aina
  x = Math.round(x / SNAP_SIZE) * SNAP_SIZE
  y = Math.round(y / SNAP_SIZE) * SNAP_SIZE

  const cab = allCabinets.value.find(c => c.id === cabinetId)
  if (cab) { cab.map_x = x; cab.map_y = y }

  saveQueue.value = new Map(saveQueue.value.set(cabinetId, {
    map_x: x,
    map_y: y,
    color: cab?.color,
  }))
})

// ─── Värin asetus ─────────────────────────────────────────────────
function asetaKaappiVari(cabinetId, vari) {
  const cab = allCabinets.value.find(c => c.id === cabinetId)
  if (!cab) return
  cab.color = vari

  //Lisää tallennusjonoon säilyttäen sijainnin
  const nykyinen = saveQueue.value.get(cabinetId) || {}
  saveQueue.value = new Map(saveQueue.value.set(cabinetId, {
    map_x: cab.map_x,
    map_y: cab.map_y,
    ...nykyinen,
    color: vari,
  }))

  setNodes(buildNodes())
}

// ─── Place cabinet from sidebar ───────────────────────────────────
function placeOnMap(cabinet) {
  const { x, y, zoom } = viewport.value
  const rect = containerRef.value.getBoundingClientRect()
  const worldCx = (-x / zoom) + (rect.width  / zoom) / 2 - NODE_W / 2
  const worldCy = (-y / zoom) + (rect.height / zoom) / 2 - NODE_H / 2

  const px = Math.round(worldCx / SNAP_SIZE) * SNAP_SIZE
  const py = Math.round(worldCy / SNAP_SIZE) * SNAP_SIZE

  const cab = allCabinets.value.find(c => c.id === cabinet.id)
  if (cab) { cab.map_x = px; cab.map_y = py }

  saveQueue.value = new Map(saveQueue.value.set(cabinet.id, {
    map_x: px,
    map_y: py,
    color: cab?.color,
  }))
  setNodes(buildNodes())
}

// ─── Remove from map ──────────────────────────────────────────────
function removeFromMap(cabinetId) {
  const cab = allCabinets.value.find(c => c.id === cabinetId)
  if (cab) { cab.map_x = null; cab.map_y = null }

  saveQueue.value = new Map(saveQueue.value.set(cabinetId, {
    map_x: null,
    map_y: null,
    color: cab?.color,
  }))
  if (selectedId.value === cabinetId) selectedId.value = null
  setNodes(buildNodes())
}

// ─── Save all pending ─────────────────────────────────────────────
async function saveAll() {
  if (saveQueue.value.size === 0) return
  isSaving.value = true
  const entries = [...saveQueue.value.entries()]
  const results = await Promise.allSettled(
    entries.map(([id, pos]) => updateCabinetPosition(id, pos))
  )

  const newSaved = new Set(savedIds.value)
  const newQueue = new Map(saveQueue.value)

  results.forEach((r, i) => {
    const [id] = entries[i]
    if (r.status === 'fulfilled') {
      newQueue.delete(id)
      newSaved.add(id)
      setTimeout(() => {
        savedIds.value = new Set([...savedIds.value].filter(x => x !== id))
      }, 2000)
    } else {
      errors.value.push(`Kaappi ${id} tallennus epäonnistui`)
    }
  })

  saveQueue.value = newQueue
  savedIds.value  = newSaved
  isSaving.value  = false
}

// ─── Reset unsaved changes ────────────────────────────────────────
async function resetChanges() {
  saveQueue.value = new Map()
  await loadCabinets()
  setNodes(buildNodes())
}

watch(selectedId, () => setNodes(buildNodes()))
</script>

<template>
  <div class="map-editor">

    <!-- ── TOP BAR ─────────────────────────────────────────────── -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="topbar-icon"><Warehouse :size="15" /></div>
        <span class="topbar-title">Karttaeditori</span>
        <span class="topbar-divider" />
        <span class="topbar-sub">{{ placedCabinets.length }} kaappia kartalla</span>
      </div>

      <div class="topbar-right">
        <button
          class="tool-btn"
          :disabled="pendingCount === 0"
          @click="resetChanges"
          title="Peruuta tallentamattomat muutokset"
        >
          <RotateCcw :size="14" />
          <span>Peruuta</span>
        </button>

        <button
          class="tool-btn tool-btn--save"
          :class="{ 'tool-btn--pending': pendingCount > 0 }"
          :disabled="pendingCount === 0 || isSaving"
          @click="saveAll"
        >
          <Save :size="14" />
          <span v-if="isSaving">Tallennetaan…</span>
          <span v-else-if="pendingCount > 0">Tallenna ({{ pendingCount }})</span>
          <span v-else>Tallennettu</span>
        </button>
      </div>
    </header>

    <!-- ── ERRORS ─────────────────────────────────────────────── -->
    <div v-if="errors.length" class="errors">
      <div v-for="(e, i) in errors" :key="i" class="error-item">
        <AlertCircle :size="13" />
        <span>{{ e }}</span>
        <button @click="errors.splice(i, 1)"><X :size="11" /></button>
      </div>
    </div>

    <!-- ── BODY ───────────────────────────────────────────────── -->
    <div class="body">

      <!-- ── SIDEBAR ── -->
      <aside class="sidebar" :class="{ 'sidebar--closed': !sidebarOpen }">
        <div class="sidebar-inner">

          <div class="sidebar-head">
            <span class="sidebar-title">Kaapit</span>
            <button class="icon-btn" @click="sidebarOpen = !sidebarOpen" :aria-label="sidebarOpen ? 'Sulje sivupalkki' : 'Avaa sivupalkki'">
              <ChevronDown :size="13" :style="{ transform: sidebarOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }" />
            </button>
          </div>

          <template v-if="sidebarOpen">
            <div class="search-wrap">
              <Search :size="12" class="search-icon" />
              <input
                v-model="searchQuery"
                class="search-input"
                placeholder="Hae kaappia…"
                aria-label="Hae kaappia"
              />
              <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''" aria-label="Tyhjennä haku">
                <X :size="10" />
              </button>
            </div>

            <!-- Kartalla olevat kaapit -->
            <div class="section-label">Kartalla ({{ placedCabinets.length }})</div>
            <div class="cab-list">
              <div
                v-for="c in placedCabinets"
                :key="c.id"
                class="cab-item cab-item--placed"
                :class="{ 'cab-item--selected': selectedId === c.id }"
                @click="selectedId = selectedId === c.id ? null : c.id"
                role="button"
                :aria-pressed="selectedId === c.id"
                :aria-label="`Kaappi ${c.number}`"
              >
                <div class="cab-dot" :style="{ background: c.color || '#2563eb' }" />
                <div class="cab-info">
                  <span class="cab-num">{{ c.number }}</span>
                  <span class="cab-ware">{{ c.varasto_nimi }}</span>
                </div>
                <div class="cab-actions">
                  <span v-if="saveQueue.has(c.id)" class="unsaved-dot" title="Tallentamaton muutos" />
                  <span v-if="savedIds.has(c.id)" class="saved-check"><Check :size="10" /></span>
                  <button
                    class="icon-btn icon-btn--danger"
                    title="Poista kartalta"
                    :aria-label="`Poista kaappi ${c.number} kartalta`"
                    @click.stop="removeFromMap(c.id)"
                  >
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
              <div v-if="!placedCabinets.length" class="empty-hint">Ei kaappeja kartalla</div>
            </div>

            <!-- Värinvalitsin valitulle kaapille -->
            <transition name="fade-slide">
              <div v-if="selectedCabinet" class="color-picker" role="group" aria-label="Kaapin väri">
                <div class="color-picker-head">
                  <Palette :size="11" />
                  <span class="color-picker-label">Väri — {{ selectedCabinet.number }}</span>
                </div>
                <div class="color-swatches">
                  <button
                    v-for="v in KAAPPI_VARIT"
                    :key="v.arvo"
                    class="color-swatch"
                    :style="{ background: v.arvo }"
                    :class="{ 'color-swatch--active': (selectedCabinet.color || '#2563eb') === v.arvo }"
                    :title="v.nimi"
                    :aria-label="v.nimi"
                    :aria-pressed="(selectedCabinet.color || '#2563eb') === v.arvo"
                    @click="asetaKaappiVari(selectedCabinet.id, v.arvo)"
                  />
                </div>
              </div>
            </transition>

            <!-- Asettamattomat kaapit -->
            <div class="section-label section-label--gap">
              <button class="section-toggle" @click="showUnplaced = !showUnplaced" :aria-expanded="showUnplaced">
                <EyeOff v-if="!showUnplaced" :size="11" />
                <Eye v-else :size="11" />
                Asettamattomat ({{ unplacedCabinets.length }})
              </button>
            </div>

            <template v-if="showUnplaced">
              <div class="cab-list">
                <div
                  v-for="c in filteredUnplaced"
                  :key="c.id"
                  class="cab-item cab-item--unplaced"
                >
                  <div class="cab-info">
                    <span class="cab-num">{{ c.number }}</span>
                    <span class="cab-ware">{{ c.varasto_nimi }}</span>
                  </div>
                  <button
                    class="icon-btn icon-btn--place"
                    title="Lisää karttaan"
                    :aria-label="`Lisää kaappi ${c.number} karttaan`"
                    @click="placeOnMap(c)"
                  >
                    <MapPin :size="11" />
                  </button>
                </div>
                <div v-if="!filteredUnplaced.length && searchQuery" class="empty-hint">Ei tuloksia</div>
                <div v-else-if="!unplacedCabinets.length" class="empty-hint">Kaikki kaapit kartalla 🎉</div>
              </div>
            </template>
          </template>
        </div>
      </aside>

      <!-- ── MAP ── -->
      <div class="map-wrap" ref="containerRef">
        <div v-if="isLoading" class="map-loading">
          <div class="spinner" />
          <span>Ladataan…</span>
        </div>

        <div v-if="viewport.zoom < DETAIL_ZOOM && !isLoading" class="zoom-hint">
          Zoomaa sisään nähdäksesi kaapit
        </div>

        <VueFlow
          :node-types="nodeTypes"
          :nodes-draggable="true"
          :nodes-connectable="false"
          :elements-selectable="true"
          :min-zoom="minZoom"
          :max-zoom="MAX_ZOOM"
          class="flow-canvas"
        >
          <template #node-cabinet="nodeProps">
            <CabinetNode
              v-bind="nodeProps"
              :zoom="viewport.zoom"
              :detail-zoom="DETAIL_ZOOM"
              :edit-mode="true"
            />
          </template>
          <Controls />
          <MiniMap />
        </VueFlow>
      </div>

    </div>

    <div class="footer-hint">
      <Move :size="11" /> Vedä kaappi siirtääksesi &nbsp;·&nbsp;
      <MapPin :size="11" /> Lisää sivupalkista &nbsp;·&nbsp;
      <Palette :size="11" /> Valitse kaappi muuttaaksesi väriä &nbsp;·&nbsp;
      <Save :size="11" /> Tallenna muutokset
    </div>

  </div>
</template>

<style scoped>
.map-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background-secondary);
  overflow: hidden;
}

.body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── TOPBAR ── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  background: var(--color-background-primary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
  flex-shrink: 0;
  gap: 12px;
}

.topbar-left,
.topbar-right { display: flex; align-items: center; gap: 8px; }

.topbar-icon {
  width: 28px; height: 28px; border-radius: 7px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-secondary);
}

.topbar-title   { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.topbar-divider { width: 1px; height: 16px; background: var(--color-border-tertiary); }
.topbar-sub     { font-size: 11px; color: var(--color-text-tertiary); }

.tool-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 7px;
  border: 0.5px solid var(--color-border-secondary);
  background: var(--color-background-secondary);
  font-size: 11px; font-weight: 500; color: var(--color-text-secondary);
  cursor: pointer; transition: background 0.1s, border-color 0.1s, opacity 0.1s;
  white-space: nowrap;
}
.tool-btn:hover:not(:disabled) { background: var(--color-background-tertiary); }
.tool-btn:disabled { opacity: 0.4; cursor: default; }
.tool-btn--save { background: var(--color-background-secondary); color: var(--color-text-tertiary); }
.tool-btn--pending { background: #2563eb; color: #fff; border-color: #1d4ed8; }
.tool-btn--pending:hover:not(:disabled) { background: #1d4ed8; }

/* ── ERRORS ── */
.errors {
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px 16px;
  background: var(--color-background-primary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.error-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #dc2626;
}
.error-item button { background: none; border: none; cursor: pointer; color: #dc2626; padding: 0; }

/* ── SIDEBAR ── */
.sidebar {
  width: 240px; flex-shrink: 0;
  background: var(--color-background-primary);
  border-right: 0.5px solid var(--color-border-tertiary);
  display: flex; flex-direction: column; overflow: hidden;
  transition: width 0.2s ease;
}
.sidebar--closed { width: 36px; }

.sidebar-inner {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 8px 0;
}

.sidebar-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px 8px;
}
.sidebar-title {
  font-size: 11px; font-weight: 600; color: var(--color-text-primary);
  letter-spacing: 0.05em; text-transform: uppercase;
}

.search-wrap { position: relative; margin: 0 8px 6px; }
.search-icon {
  position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
  color: var(--color-text-tertiary); pointer-events: none;
}
.search-input {
  width: 100%; padding: 5px 26px 5px 26px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 7px; background: var(--color-background-secondary);
  font-size: 11px; color: var(--color-text-primary); outline: none;
  box-sizing: border-box;
}
.search-input::placeholder { color: var(--color-text-tertiary); }
.search-input:focus { border-color: #2563eb; }
.search-clear {
  position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--color-text-tertiary); padding: 0;
}

.section-label {
  font-size: 10px; font-weight: 600; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 4px 12px 2px;
}
.section-label--gap {
  margin-top: 8px;
  border-top: 0.5px solid var(--color-border-tertiary);
  padding-top: 8px;
}

.section-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: none; cursor: pointer;
  font-size: 10px; font-weight: 600; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.06em; padding: 0;
}

.cab-list {
  display: flex; flex-direction: column; gap: 1px;
  padding: 2px 6px; max-height: 260px; overflow-y: auto;
}

.cab-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 6px; border-radius: 6px;
  cursor: pointer; transition: background 0.1s;
}
.cab-item:hover                { background: var(--color-background-secondary); }
.cab-item--selected            { background: var(--color-background-secondary); }
.cab-item--unplaced            { opacity: 0.65; cursor: default; }
.cab-item--unplaced:hover      { opacity: 1; }

.cab-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; transition: background 0.2s; }
.cab-info { flex: 1; min-width: 0; }
.cab-num  { font-size: 11px; font-weight: 600; color: var(--color-text-primary); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cab-ware { font-size: 9px; color: var(--color-text-tertiary); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cab-actions { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }

.unsaved-dot { width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; display: inline-block; }
.saved-check { color: #22c55e; display: flex; }
.empty-hint  { font-size: 10px; color: var(--color-text-tertiary); padding: 6px 4px; }

.icon-btn {
  width: 22px; height: 22px; border-radius: 5px;
  background: transparent; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-tertiary); transition: background 0.1s, color 0.1s;
}
.icon-btn:hover         { background: var(--color-background-secondary); color: var(--color-text-primary); }
.icon-btn--danger:hover { background: #fee2e2; color: #dc2626; }
.icon-btn--place:hover  { background: #dbeafe; color: #2563eb; }

/* ── VÄRINVALITSIN ── */
.color-picker {
  margin: 4px 8px 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
}

.color-picker-head {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  color: var(--color-text-tertiary);
}

.color-picker-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s, box-shadow 0.1s;
  outline: none;
}
.color-swatch:hover {
  transform: scale(1.2);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.color-swatch:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
.color-swatch--active {
  border-color: var(--color-text-primary);
  transform: scale(1.15);
  box-shadow: 0 1px 6px rgba(0,0,0,0.25);
}

/* Fade-slide animaatio värinvalitsimelle */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── MAP ── */
.map-wrap    { flex: 1; position: relative; overflow: hidden; }
.flow-canvas { width: 100%; height: 100%; }

.map-loading {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; background: var(--color-background-secondary);
  font-size: 12px; color: var(--color-text-tertiary);
}

.spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--color-border-secondary);
  border-top-color: #2563eb;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.zoom-hint {
  position: absolute; bottom: 48px; left: 50%; transform: translateX(-50%);
  z-index: 5; pointer-events: none;
  font-size: 11px; color: var(--color-text-tertiary);
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 20px; padding: 4px 12px;
}

.footer-hint {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 16px;
  font-size: 10px; color: var(--color-text-tertiary);
  background: var(--color-background-primary);
  border-top: 0.5px solid var(--color-border-tertiary);
  flex-shrink: 0;
}

:deep(.vue-flow__controls) {
  border: 0.5px solid var(--color-border-tertiary) !important;
  border-radius: 8px !important; overflow: hidden; box-shadow: none !important;
}
:deep(.vue-flow__controls-button) {
  background: var(--color-background-primary) !important;
  border-bottom: 0.5px solid var(--color-border-tertiary) !important;
  color: var(--color-text-secondary) !important;
}
:deep(.vue-flow__controls-button:hover) { background: var(--color-background-secondary) !important; }
:deep(.vue-flow__minimap) {
  border: 0.5px solid var(--color-border-tertiary) !important;
  border-radius: 8px !important; overflow: hidden;
}
:deep(.vue-flow__node.selected > *) {
  box-shadow: 0 0 0 2px #2563eb !important;
  border-radius: 7px;
}
</style>