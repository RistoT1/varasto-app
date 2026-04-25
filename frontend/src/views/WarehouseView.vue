<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { getWarehouses, getWarehouseCabinets, getWarehouseItems } from '@/api/warehouses.js'
import { createCabinet } from '@/api/cabinets.js'
import { Layers, ChevronRight, ArrowLeft, Plus, X, AlertCircle, Search, Package, ChevronLeft } from 'lucide-vue-next'
import WarehouseMap from '@/components/VarastoPohjakartta/WarehouseMap.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

const warehouseId = computed(() => Number(route.params.id))
const warehouse = ref(null)
const cabinets = ref([])
const loading = ref(false)

const mapSrc = computed(() => {
  const key = warehouse.value?.name?.split(' ')[0]
  return key ? `/images/warehouse-map-${key}.jpg` : '/images/warehouse-map.jpg'
})

function sanitize(val) { return String(val ?? '').replace(/<[^>]*>/g, '').trim() }

async function fetchData() {
  loading.value = true
  try {
    const [warehousesRes, cabinetsRes] = await Promise.all([
      getWarehouses(),
      getWarehouseCabinets(warehouseId.value)
    ])
    const all = Array.isArray(warehousesRes) ? warehousesRes : (warehousesRes.data ?? [])
    warehouse.value = all.find(w => w.id === warehouseId.value) ?? null
    cabinets.value = Array.isArray(cabinetsRes) ? cabinetsRes : (cabinetsRes.data ?? [])
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

// ── Items — all loaded once, filtered + paginated client-side ──
const allItems = ref([])
const itemsLoading = ref(false)

async function fetchAllItems() {
  itemsLoading.value = true
  try {
    let page = 1
    const collected = []
    while (true) {
      const res = await getWarehouseItems(warehouseId.value, { page, limit: 200 })
      collected.push(...(Array.isArray(res) ? res : (res.data ?? [])))
      const pg = res.pagination
      if (!pg || page >= pg.pages) break
      page++
    }
    allItems.value = collected
  } catch (e) { console.error(e) }
  finally { itemsLoading.value = false }
}

// ── Search + pagination ──
const itemQuery = ref('')
const currentPage = ref(1)
const PAGE_SIZE = 50

watch(itemQuery, () => { currentPage.value = 1 })

const filteredItems = computed(() => {
  const q = itemQuery.value.trim().toLowerCase()
  if (!q) return allItems.value
  return allItems.value.filter(i =>
    i.name?.toLowerCase().includes(q) ||
    i.tag?.toLowerCase().includes(q) ||
    i.note?.toLowerCase().includes(q) ||
    i.cabinet?.toLowerCase().includes(q) ||
    i.shelf?.toLowerCase().includes(q)
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

// ── Create cabinet ──
const showCreateCabinet = ref(false)
const createCabinetNum = ref('')
const createCabinetLoading = ref(false)
const createCabinetError = ref(null)

function openCreateCabinet() {
  createCabinetNum.value = ''
  createCabinetError.value = null
  showCreateCabinet.value = true
}

async function submitCreateCabinet() {
  createCabinetError.value = null
  const num = sanitize(createCabinetNum.value)
  if (!num) { createCabinetError.value = 'Kaapin numero on pakollinen.'; return }
  if (num.length > 8) { createCabinetError.value = 'Max 8 merkkiä.'; return }
  createCabinetLoading.value = true
  try {
    await createCabinet({ number: num, varasto_id: warehouseId.value })
    showCreateCabinet.value = false
    await fetchData()
  } catch (e) {
    createCabinetError.value = e.response?.data?.error ?? 'Luonti epäonnistui.'
  } finally { createCabinetLoading.value = false }
}

onMounted(() => { fetchData(); fetchAllItems() })
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">

    <!-- Header -->
    <div class="border-b border-border px-6 py-4 flex items-center gap-3">
      <button @click="router.push({ path: '/warehouses', query: route.query })"
        class="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors shrink-0">
        <ArrowLeft :size="14" />
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-base font-semibold tracking-tight truncate">
          {{ warehouse?.name ?? '…' }}
        </h1>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ warehouse?.cabinetCount ?? 0 }} kaappia · {{ warehouse?.shelfCount ?? 0 }} hyllyä
        </p>
      </div>
      <button v-if="isAdmin" @click="openCreateCabinet"
        class="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity shrink-0">
        <Plus :size="13" /> Uusi kaappi
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
          stroke-dashoffset="12" stroke-linecap="round" />
      </svg>
    </div>

    <div v-else class="px-6 pt-5 pb-8 max-w-2xl mx-auto w-full flex flex-col gap-2">

      <div v-if="!warehouse" class="text-sm text-muted-foreground py-8 text-center">Varastoa ei löydy.</div>

      <template v-else>

        <!-- ── Tavarat ── -->
        <div class="flex items-center gap-3 mb-2">
          <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase shrink-0">
            Tavarat
            <span class="normal-case tracking-normal font-normal ml-1 tabular-nums">
              ({{ itemsLoading ? '…' : filteredItems.length }}<template
                v-if="itemQuery && filteredItems.length !== allItems.length"> / {{ allItems.length }}</template>)
            </span>
          </p>
          <div class="relative flex-1">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              :size="13" />
            <input v-model="itemQuery" type="text" placeholder="Suodata tavaroita…" autocomplete="off"
              class="w-full h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow placeholder:text-muted-foreground" />
            <svg v-if="itemsLoading"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
              viewBox="0 0 24 24" fill="none" width="12" height="12">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                stroke-dashoffset="12" stroke-linecap="round" />
            </svg>
            <button v-else-if="itemQuery" @click="itemQuery = ''"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X :size="12" />
            </button>
          </div>
        </div>

        <!-- Items table -->
        <div class="border border-border rounded-xl overflow-hidden">
          <div
            class="grid grid-cols-[1fr_4rem_3.5rem] gap-x-2 px-4 py-2 bg-muted/40 border-b border-border text-[11px] font-medium text-muted-foreground tracking-widest uppercase">
            <span>Nimi</span>
            <span class="text-right">Kaappi</span>
            <span class="text-right">Hylly</span>
          </div>

          <div v-if="itemsLoading" class="flex items-center justify-center py-8">
            <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="16" height="16">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                stroke-dashoffset="12" stroke-linecap="round" />
            </svg>
          </div>

          <div v-else-if="!pagedItems.length" class="px-4 py-4 text-xs text-muted-foreground">
            {{ itemQuery ? `Ei tuloksia haulle "${itemQuery}"` : 'Ei tavaroita' }}
          </div>

          <div v-else v-for="item in pagedItems" :key="item.id"
            class="group grid grid-cols-[1fr_4rem_3.5rem] gap-x-2 items-center px-4 py-3.5 sm:py-2.5 text-sm border-b border-border last:border-0 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
            @click="router.push({ path: `/items/${item.id}`, query: route.query })">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-6 h-6 sm:w-5 sm:h-5 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                <Package :size="11" />
              </div>
              <div class="min-w-0">
                <span class="font-medium truncate block">{{ item.name }}</span>
                <span v-if="item.note" class="text-xs text-muted-foreground truncate block">{{ item.note }}</span>
              </div>
            </div>
            <span class="text-xs text-muted-foreground tabular-nums truncate text-right">{{ item.cabinet ?? '—' }}</span>
            <span class="text-xs text-muted-foreground tabular-nums truncate text-right">{{ item.shelf ?? '—' }}</span>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between pt-1">
          <button :disabled="currentPage <= 1" @click="currentPage--"
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/25 disabled:opacity-40 disabled:pointer-events-none transition-colors">
            <ChevronLeft :size="13" /> Edellinen
          </button>
          <span class="text-xs text-muted-foreground tabular-nums">Sivu {{ currentPage }} / {{ totalPages }}</span>
          <button :disabled="currentPage >= totalPages" @click="currentPage++"
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/25 disabled:opacity-40 disabled:pointer-events-none transition-colors">
            Seuraava <ChevronRight :size="13" />
          </button>
        </div>

        <!-- ── Kaapit ── -->
        <div class="border-t border-border mt-6 mb-2" />
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-2">Kaapit</p>

        <div class="border border-border rounded-xl overflow-hidden">
          <div v-if="!cabinets.length" class="px-4 py-4 text-xs text-muted-foreground">Ei kaappeja</div>
          <div v-else>
            <div v-for="c in cabinets" :key="c.id"
              class="group flex items-center gap-3 px-4 py-3.5 sm:py-3 text-sm border-b border-border last:border-0 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
              @click="router.push({ path: `/cabinets/${c.id}`, query: route.query })">
              <div
                class="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                <Layers :size="13" />
              </div>
              <span class="font-medium flex-1 truncate">{{ c.number }}</span>
              <span class="text-xs text-muted-foreground">{{ c.shelfCount }} hyllyä</span>
              <ChevronRight :size="13"
                class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>

        <!-- Map -->
        <template v-if="mapSrc">
          <div class="border-t border-border mt-6 mb-4" />
          <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Pohjakartta</p>
          <WarehouseMap :map-src="mapSrc" style="height: 400px;" />
        </template>

      </template>
    </div>

    <!-- Create cabinet modal -->
    <Transition name="modal">
      <div v-if="showCreateCabinet" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showCreateCabinet = false" />
        <div
          class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <p class="text-sm font-semibold">Uusi kaappi — {{ warehouse?.name }}</p>
            <button @click="showCreateCabinet = false" class="text-muted-foreground hover:text-foreground">
              <X :size="16" />
            </button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-3">
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Kaapin numero *</label>
              <input v-model="createCabinetNum" maxlength="8" type="text" placeholder="esim. 1.1"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow" />
            </div>
            <div v-if="createCabinetError"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle :size="12" class="text-destructive shrink-0" />
              <span class="text-xs text-destructive">{{ createCabinetError }}</span>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-border flex items-center justify-between">
            <button @click="showCreateCabinet = false"
              class="text-xs text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="submitCreateCabinet" :disabled="createCabinetLoading"
              class="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ createCabinetLoading ? 'Luodaan…' : 'Luo kaappi' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>