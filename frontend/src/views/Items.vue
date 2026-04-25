<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { searchItems, getItems, createItem } from '@/api/items.js'
import { getProductGroups, getProductGroupItems } from '@/api/productGroups.js'
import { getCabinets, getCabinetShelves } from '@/api/cabinets.js'
import { getBoxes } from '@/api/boxes.js'
import { Search, Tag, ArrowRight, Package, X, AlertCircle, MapPin } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

// ── QR / Varaa mode ──
const isVaraaMode = computed(() => route.query.Varaa === '1')

// ── Search ──
const query = ref('')
const searchLoading = ref(false)
const isSearching = computed(() => query.value.trim().length >= 2)
let debounceTimer = null
let abortController = null

function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (isSearching.value) doSearch(query.value)
    else fetchItems()
  }, 300)
}

async function doSearch(q) {
  if (abortController) abortController.abort()
  abortController = new AbortController()
  searchLoading.value = true
  try {
    const res = await searchItems({ query: q, limit: 100, signal: abortController.signal })
    items.value = res.data ?? []
    pagination.value = res.pagination ?? { page: 1, limit: 100, total: res.data?.length ?? 0, pages: 1 }
  } catch (e) {
    if (e.name !== 'AbortError' && e.name !== 'CanceledError') console.error(e)
  } finally {
    searchLoading.value = false
  }
}

function clearSearch() {
  query.value = ''
  fetchItems()
}

// ── Product groups ──
const groups = ref([])
const groupsLoading = ref(false)
const selectedGroup = ref(null)

// ── Items ──
const items = ref([])
const itemsLoading = ref(false)
const pagination = ref({ page: 1, limit: 50, total: 0, pages: 1 })
const page = ref(1)

const loading = computed(() => itemsLoading.value || searchLoading.value)

async function fetchGroups() {
  groupsLoading.value = true
  try {
    const res = await getProductGroups()
    groups.value = Array.isArray(res) ? res : (res.data ?? [])
  } catch (e) { console.error(e) }
  finally { groupsLoading.value = false }
}

async function fetchItems() {
  itemsLoading.value = true
  try {
    if (selectedGroup.value) {
      const res = await getProductGroupItems(selectedGroup.value.id, { page: page.value })
      items.value = res.data ?? []
      pagination.value = res.pagination ?? { page: page.value, limit: 50, total: res.count ?? 0, pages: Math.ceil((res.count ?? 0) / 50) }
    } else {
      const res = await getItems({ page: page.value })
      items.value = res.data ?? []
      pagination.value = res.pagination ?? { page: 1, limit: 50, total: 0, pages: 1 }
    }
  } catch (e) { console.error(e) }
  finally { itemsLoading.value = false }
}

function selectGroup(g) {
  selectedGroup.value = selectedGroup.value?.id === g.id ? null : g
  query.value = ''
  page.value = 1
  fetchItems()
}

function clearGroup() {
  selectedGroup.value = null
  page.value = 1
  fetchItems()
}

function navigateToItem(id) {
  if (isVaraaMode.value) {
    router.push({ path: `/items/${id}`, query: { Varaa: '1' } })
  } else {
    router.push(`/items/${id}`)
  }
}

// ── Create item modal ──
const showCreate = ref(false)
const createLoading = ref(false)
const createError = ref(null)
const cabinets = ref([])
const shelves  = ref([])
const boxes    = ref([])
const createForm = ref({
  name: '', note: '', tag: '',
  tuoteryhma_id: null,
  kaappi_id: null,
  hylly_id: null,
  laatikko_id: null,
})

watch(() => createForm.value.kaappi_id, async (kaappi_id) => {
  createForm.value.hylly_id = null
  shelves.value = []
  if (!kaappi_id) return
  try {
    const res = await getCabinetShelves(kaappi_id)
    shelves.value = Array.isArray(res) ? res : (res.data ?? [])
  } catch { /* ignore */ }
})

function sanitizeStr(val) {
  return String(val ?? '').replace(/<[^>]*>/g, '').trim()
}

async function openCreate() {
  createForm.value = { name: '', note: '', tag: '', tuoteryhma_id: null, kaappi_id: null, hylly_id: null, laatikko_id: null }
  createError.value = null
  shelves.value = []
  if (!cabinets.value.length) {
    try {
      const [cabRes, boxRes] = await Promise.all([getCabinets(), getBoxes()])
      cabinets.value = Array.isArray(cabRes) ? cabRes : (cabRes.data ?? [])
      boxes.value    = Array.isArray(boxRes) ? boxRes : (boxRes.data ?? [])
    } catch { /* ignore */ }
  }
  showCreate.value = true
}

async function submitCreate() {
  createError.value = null
  const name = sanitizeStr(createForm.value.name)
  if (!name) { createError.value = 'Nimi on pakollinen.'; return }
  if (name.length > 128) { createError.value = 'Nimi max 128 merkkiä.'; return }
  const tag = sanitizeStr(createForm.value.tag)
  if (tag.length > 16) { createError.value = 'Tunniste max 16 merkkiä.'; return }
  const note = sanitizeStr(createForm.value.note)
  if (note.length > 255) { createError.value = 'Huomio max 255 merkkiä.'; return }

  createLoading.value = true
  try {
    const created = await createItem({
      name,
      note:          note || undefined,
      tag:           tag  || null,
      tuoteryhma_id: createForm.value.tuoteryhma_id ?? null,
      hylly_id:      createForm.value.hylly_id      ?? null,
      laatikko_id:   createForm.value.laatikko_id    ?? null,
    })
    showCreate.value = false
    router.push(`/items/${created.id}`)
  } catch (e) {
    createError.value = e.response?.data?.error ?? 'Luonti epäonnistui.'
  } finally {
    createLoading.value = false
  }
}

onMounted(() => {
  fetchGroups()
  fetchItems()
})
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">

    <!-- ══════════════════════════════════════════
         VARAA MODE — minimal fast mobile view
    ══════════════════════════════════════════ -->
    <template v-if="isVaraaMode">
      <div class="flex flex-col h-screen">

        <!-- Header -->
        <div class="px-5 pt-6 pb-4 shrink-0">
          <p class="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Varaa</p>
          <h1 class="text-2xl font-black tracking-tight">Valitse tavara</h1>
        </div>

        <!-- Search -->
        <div class="px-5 pb-4 shrink-0">
          <div class="relative flex items-center">
            <Search class="absolute left-4 text-muted-foreground pointer-events-none" :size="16" />
            <input
              v-model="query"
              type="text"
              placeholder="Hae nimellä tai tunnisteella…"
              autocomplete="off"
              @input="onInput"
              autofocus
              class="w-full h-12 pl-11 pr-10 text-base bg-muted border-0 rounded-2xl outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring transition-shadow"
            />
            <button v-if="query" @click="clearSearch" class="absolute right-4 text-muted-foreground">
              <X :size="16" />
            </button>
            <svg v-else-if="searchLoading" class="absolute right-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="16" height="16">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto px-5 pb-8">
          <div v-if="loading" class="flex justify-center pt-12">
            <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
            </svg>
          </div>

          <div v-else-if="!items.length" class="flex flex-col items-center justify-center gap-2 pt-16 text-muted-foreground">
            <Package :size="32" class="opacity-30" />
            <p class="text-sm">{{ isSearching ? 'Ei hakutuloksia' : 'Ei tavaroita' }}</p>
          </div>

          <div v-else class="flex flex-col gap-2">
            <button
              v-for="item in items"
              :key="item.id ?? item.ID"
              @click="navigateToItem(item.id ?? item.ID)"
              class="flex items-center justify-between w-full px-4 py-4 bg-muted/50 rounded-2xl text-left active:scale-[0.98] transition-transform"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-base font-semibold truncate">{{ item.name ?? item.Nimi }}</span>
                <span v-if="item.productGroup?.name" class="text-xs text-muted-foreground">{{ item.productGroup.name }}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span v-if="item.tag ?? item.Tunniste" class="text-xs font-mono text-muted-foreground">{{ item.tag ?? item.Tunniste }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════
         NORMAL MODE
    ══════════════════════════════════════════ -->
    <template v-else>

      <!-- Header -->
      <div class="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-base font-semibold tracking-tight">Tavarat</h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            <template v-if="isSearching">Hakutulokset · {{ pagination.total }} kpl</template>
            <template v-else>
              {{ selectedGroup ? selectedGroup.name : 'Kaikki tavarat' }}
              <span v-if="pagination.total"> · {{ pagination.total }} kpl</span>
            </template>
          </p>
        </div>
        <button v-if="isAdmin" @click="openCreate"
          class="h-8 px-3.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity">
          + Uusi tavara
        </button>
      </div>

      <!-- Search -->
      <div class="px-6 pt-4 max-w-2xl mx-auto w-full">
        <div class="relative flex items-center">
          <Search class="absolute left-3.5 text-muted-foreground pointer-events-none" :size="15" />
          <input v-model="query" type="text" placeholder="Hae tavaroita nimellä, tunnisteella…"
            autocomplete="off" @input="onInput"
            class="w-full h-10 pl-10 pr-10 text-sm bg-background border border-input rounded-xl outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          <button v-if="query" @click="clearSearch" class="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors">
            <X :size="14" />
          </button>
          <svg v-else-if="searchLoading" class="absolute right-3.5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="15" height="15">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <!-- Product group chips -->
      <div class="px-6 pt-4 max-w-2xl mx-auto w-full">
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-2.5">Tuoteryhmät</p>
        <div v-if="groupsLoading" class="flex gap-2">
          <div v-for="i in 4" :key="i" class="h-7 w-20 rounded-full bg-muted animate-pulse" />
        </div>
        <div v-else class="flex flex-wrap gap-1.5">
          <button @click="clearGroup"
            :class="['inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors',
              !selectedGroup ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground']">
            <Package :size="11" /> Kaikki
          </button>
          <button v-for="g in groups" :key="g.id" @click="selectGroup(g)"
            :class="['inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors',
              selectedGroup?.id === g.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground']">
            <Tag :size="10" /> {{ g.name }}
          </button>
        </div>
      </div>

      <!-- Items list -->
      <div class="px-6 pt-5 pb-8 max-w-2xl mx-auto w-full flex-1">
        <div class="border-t border-border mb-4" />

        <div v-if="loading" class="flex items-center justify-center py-12">
          <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
          </svg>
        </div>

        <div v-else-if="!items.length" class="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <Package :size="28" class="opacity-40" />
          <p class="text-sm">{{ isSearching ? 'Ei hakutuloksia' : 'Ei tavaroita' }}</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-2">
          <button v-for="item in items" :key="item.id ?? item.ID"
            @click="router.push(`/items/${item.id ?? item.ID}`)"
            class="group flex items-center justify-between px-4 py-3 bg-background border border-border rounded-xl text-left transition-all hover:border-foreground/25 hover:bg-muted/40">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-sm font-medium truncate">{{ item.name ?? item.Nimi }}</span>
              <span v-if="item.productGroup?.name" class="text-xs text-muted-foreground">{{ item.productGroup.name }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span v-if="item.tag ?? item.Tunniste" class="text-xs font-mono text-muted-foreground">{{ item.tag ?? item.Tunniste }}</span>
              <ArrowRight :size="13" class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>

        <div v-if="!isSearching && pagination.pages > 1" class="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>{{ pagination.total }} kpl yhteensä</span>
          <div class="flex gap-1">
            <button :disabled="page === 1" @click="page--; fetchItems()"
              class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40 hover:bg-muted/60 transition-colors">← Edellinen</button>
            <span class="px-3 py-1.5">{{ page }} / {{ pagination.pages }}</span>
            <button :disabled="page >= pagination.pages" @click="page++; fetchItems()"
              class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40 hover:bg-muted/60 transition-colors">Seuraava →</button>
          </div>
        </div>
      </div>

      <!-- Create item modal -->
      <Transition name="modal">
        <div v-if="showCreate" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showCreate = false" />

          <div class="relative z-10 w-full sm:max-w-md bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col" style="max-height:85vh;overflow:hidden;">
            <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <p class="text-sm font-semibold">Uusi tavara</p>
              <button @click="showCreate = false" class="text-muted-foreground hover:text-foreground transition-colors">
                <X :size="16" />
              </button>
            </div>

            <div class="px-5 py-4 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
              <div>
                <label class="text-xs text-muted-foreground mb-1 block">Nimi *</label>
                <input v-model="createForm.name" maxlength="128" type="text" placeholder="Tavaran nimi"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground mb-1 block">Tunniste</label>
                <input v-model="createForm.tag" maxlength="16" type="text" placeholder="esim. ARD-001"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground mb-1 block">Huomio</label>
                <textarea v-model="createForm.note" maxlength="255" rows="2" placeholder="Vapaaehtoinen kuvaus"
                  class="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow resize-none" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground mb-1 block">Tuoteryhmä</label>
                <select v-model="createForm.tuoteryhma_id"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                  <option :value="null">— Ei tuoteryhmää —</option>
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>

              <div class="rounded-xl border border-border">
                <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                  <MapPin :size="12" class="text-muted-foreground"/>
                  <span class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Sijainti</span>
                </div>
                <div class="px-4 py-3 border-b border-border">
                  <label class="text-xs text-muted-foreground mb-1 block">Kaappi</label>
                  <select v-model="createForm.kaappi_id"
                    class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                    <option :value="null">— Ei kaappia —</option>
                    <option v-for="c in cabinets" :key="c.id" :value="c.id">
                      {{ c.warehouse.name }} › {{ c.number }}
                    </option>
                  </select>
                </div>
                <div class="px-4 py-3 border-b border-border">
                  <label class="text-xs text-muted-foreground mb-1 block">Hylly</label>
                  <select v-model="createForm.hylly_id" :disabled="!createForm.kaappi_id"
                    class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50">
                    <option :value="null">— Ei hyllyä —</option>
                    <option v-for="s in shelves" :key="s.id" :value="s.id">Hylly {{ s.number }}</option>
                  </select>
                  <p v-if="!createForm.kaappi_id" class="text-[11px] text-muted-foreground mt-1">Valitse ensin kaappi</p>
                </div>
                <div class="px-4 py-3">
                  <label class="text-xs text-muted-foreground mb-1 block">Laatikko</label>
                  <select v-model="createForm.laatikko_id"
                    class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                    <option :value="null">— Ei laatikkoa —</option>
                    <option v-for="b in boxes" :key="b.id" :value="b.id">{{ b.name }}</option>
                  </select>
                </div>
              </div>

              <div v-if="createError" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle :size="12" class="text-destructive shrink-0" />
                <span class="text-xs text-destructive">{{ createError }}</span>
              </div>
            </div>

            <div class="px-5 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
              <button @click="showCreate = false" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Peruuta</button>
              <button @click="submitCreate" :disabled="createLoading"
                class="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {{ createLoading ? 'Luodaan…' : 'Luo tavara' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

    </template>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>