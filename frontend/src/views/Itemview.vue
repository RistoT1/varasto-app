<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Package, MapPin, Tag, Hash, Box,
  Layers, Warehouse, BookOpen, Clock, CheckCircle2, Circle, CalendarDays, Timer, AlertCircle,
  Pencil, Check, Trash2, ToggleLeft, ToggleRight
} from 'lucide-vue-next'
import { getItem, updateItem, deleteItem } from '@/api/items.js'
import { getItemReservations, createReservation } from '@/api/reservations.js'
import { getProductGroups } from '@/api/productGroups.js'
import { getCabinets, getCabinetShelves } from '@/api/cabinets.js'
import { getBoxes } from '@/api/boxes.js'
import { useAuthStore } from '@/stores/auth.js'
import WarehouseMap from '@/components/VarastoPohjakartta/WarehouseMap.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

// ── Varaa mode ──
const isVaraaMode = computed(() => route.query.Varaa === '1')

const item = ref(null)
const loading = ref(true)
const error = ref(null)

const reservations = ref([])
const reservationsTotal = ref(0)
const reservationsLoading = ref(false)

// ── Edit state ──
const editing = ref(false)
const editLoading = ref(false)
const editError = ref(null)
const editSuccess = ref(false)

const groups = ref([])
const cabinets = ref([])
const shelves = ref([])
const boxes = ref([])

const editForm = ref({
  name: '', note: '', tag: '',
  tuoteryhma_id: null, kaappi_id: null, hylly_id: null, laatikko_id: null,
  return_required: false,
})

watch(() => editForm.value.kaappi_id, async (kaappi_id) => {
  editForm.value.hylly_id = null
  shelves.value = []
  if (!kaappi_id) return
  try {
    const res = await getCabinetShelves(kaappi_id)
    shelves.value = Array.isArray(res) ? res : (res.data ?? [])
  } catch { /* ignore */ }
})

function startEdit() {
  if (!item.value) return
  editForm.value = {
    name: item.value.name ?? '',
    note: item.value.note ?? '',
    tag: item.value.tag ?? '',
    tuoteryhma_id: item.value.productGroup?.id ?? null,
    kaappi_id: item.value.shelf?.cabinet?.id ?? null,
    hylly_id: item.value.shelf?.id ?? null,
    laatikko_id: item.value.box?.id ?? null,
    return_required: item.value.returnRequired ?? false,
  }
  editError.value = null
  editSuccess.value = false
  editing.value = true
}

function cancelEdit() { editing.value = false; editError.value = null }

function sanitizeStr(val) { return String(val ?? '').replace(/<[^>]*>/g, '').trim() }

async function saveEdit() {
  editError.value = null
  const name = sanitizeStr(editForm.value.name)
  if (!name) { editError.value = 'Nimi on pakollinen.'; return }
  if (name.length > 128) { editError.value = 'Nimi max 128 merkkiä.'; return }
  const tag = sanitizeStr(editForm.value.tag)
  if (tag.length > 16) { editError.value = 'Tunniste max 16 merkkiä.'; return }
  const note = sanitizeStr(editForm.value.note)
  if (note.length > 255) { editError.value = 'Huomio max 255 merkkiä.'; return }
  editLoading.value = true
  try {
    item.value = await updateItem(item.value.id, {
      name,
      note: note || undefined,
      tag: tag || null,
      tuoteryhma_id: editForm.value.tuoteryhma_id ?? null,
      hylly_id: editForm.value.hylly_id ?? null,
      laatikko_id: editForm.value.laatikko_id ?? null,
      return_required: editForm.value.return_required,
    })
    editing.value = false
    editSuccess.value = true
    setTimeout(() => { editSuccess.value = false }, 7000)
  } catch (e) {
    editError.value = e.response?.data?.error ?? 'Tallennus epäonnistui.'
  } finally { editLoading.value = false }
}

const mapSrc = computed(() => {
  const name = item.value?.shelf?.cabinet?.warehouse?.name
  const key = name?.split(' ')[0]
  return key ? `/images/warehouse-map-${key}.jpg` : '/images/warehouse-map.jpg'
})

// ── Reservation ──
const showPicker = ref(false)
const reserving = ref(false)
const reserveErr = ref(null)
const reserveOk = ref(false)
const validErr = ref(null)

function todayStr() { return new Date().toISOString().slice(0, 10) }
function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const alkuDate = ref(todayStr())
const alkuTime = ref(nowTimeStr())
const loppuDate = ref('')
const loppuTime = ref('')
const alkuDateRef = ref(null)
const alkuTimeRef = ref(null)
const loppuDateRef = ref(null)
const loppuTimeRef = ref(null)

const currentlyActive = computed(() => reservations.value.find(r => r.tila === 1))
const upcomingReservations = computed(() =>
  reservations.value.filter(r => !r.returnedAt || new Date(r.returnedAt) >= new Date())
)

// ── Delete ──
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)

async function doDelete() {
  deleteLoading.value = true
  try {
    await deleteItem(item.value.id)
    router.replace('/items')
  } catch (e) { console.error(e) }
  finally { deleteLoading.value = false }
}

onMounted(() => {
  window.scrollTo(0, 0)
  Promise.all([fetchItem(), fetchReservations(), fetchDropdowns()])
  if (isVaraaMode.value) showPicker.value = true
})

async function fetchItem() {
  try {
    item.value = await getItem(route.params.id)
  }
  catch (e) { error.value = e.response?.status === 404 ? 'Tavaraa ei löydy.' : 'Virhe ladattaessa tietoja.' }
  finally { loading.value = false }
}

async function fetchReservations() {
  reservationsLoading.value = true
  try {
    const res = await getItemReservations(route.params.id)
    reservations.value = res.data ?? []
    reservationsTotal.value = res.pagination?.total ?? 0
  } catch { /* non-critical */ }
  finally { reservationsLoading.value = false }
}

async function fetchDropdowns() {
  try {
    const [grRes, cabRes, boxRes] = await Promise.all([getProductGroups(), getCabinets(), getBoxes()])
    groups.value = Array.isArray(grRes) ? grRes : (grRes.data ?? [])
    cabinets.value = Array.isArray(cabRes) ? cabRes : (cabRes.data ?? [])
    boxes.value = Array.isArray(boxRes) ? boxRes : (boxRes.data ?? [])
  } catch (e) { console.error('fetchDropdowns error:', e) }
}

function hasConflict(alku, loppu) {
  for (const r of reservations.value) {
    if (r.tila !== 1) continue

    const rStart = new Date(r.startedAt)
    const rEnd = r.returnedAt ? new Date(r.returnedAt) : null

    // Existing reservation has no end (item currently reserved)
    if (!rEnd && !loppu) {
      if (alku >= rStart) return "open"
    } else if (!rEnd) {
      if (alku >= rStart) return "open"
    }

    // New reservation has no end
    else if (!loppu) {
      if (alku < rEnd) return "normal"
    }

    // Both have end dates
    else {
      if (alku < rEnd && loppu > rStart) return "normal"
    }
  }

  return null
}

function validate() {
  validErr.value = null

  if (!alkuDate.value || !alkuTime.value) {
    validErr.value = 'Aloitusaika on pakollinen.'
    return false
  }

  const returnRequired = item.value?.returnRequired ?? false
  const alku = new Date(`${alkuDate.value}T${alkuTime.value}`)
  let loppu = null

  if (returnRequired) {
    if (!loppuDate.value || !loppuTime.value) {
      validErr.value = 'Lopetusaika on pakollinen.'
      return false
    }

    loppu = new Date(`${loppuDate.value}T${loppuTime.value}`)

    if (loppu <= alku) {
      validErr.value = 'Lopetusajan on oltava aloitusajan jälkeen.'
      return false
    }
  }

  const conflictType = hasConflict(alku, loppu)

  if (conflictType) {
    if (conflictType === "open") {
      validErr.value = 'Tavara on jo varattu.'
    } else {
      validErr.value = 'Valittu aikaväli menee päällekkäin olemassaolevan varauksen kanssa.'
    }
    return false
  }

  return true
}

async function handleReserve() {
  if (!validate()) return
  reserving.value = true
  reserveErr.value = null
  reserveOk.value = false
  try {
    const alku = new Date(`${alkuDate.value}T${alkuTime.value}`).toISOString()
    const returnRequired = item.value?.returnRequired ?? false
    const loppu = returnRequired && loppuDate.value && loppuTime.value
      ? new Date(`${loppuDate.value}T${loppuTime.value}`).toISOString()
      : null
    await createReservation(Number(route.params.id), { userId: auth.user?.id, alku, loppu })
    reserveOk.value = true
    showPicker.value = false
    alkuDate.value = todayStr()
    alkuTime.value = nowTimeStr()
    loppuDate.value = ''
    loppuTime.value = ''
    if (!isVaraaMode.value) await fetchReservations()
    if (isVaraaMode.value) setTimeout(() => router.back(), 800)
  } catch (e) {
    reserveErr.value = e.response?.data?.message ?? e.response?.data?.error ?? 'Varaus epäonnistui.'
  } finally { reserving.value = false }
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="min-h-screen bg-background">

    <!-- ══════════════════════════════════════════
         VARAA MODE — focused reservation view
    ══════════════════════════════════════════ -->
    <template v-if="isVaraaMode">
      <div class="flex flex-col h-screen">

        <!-- Header -->
        <div class="px-5 pt-6 pb-4 max-w-200 shrink-0 flex flex-col">
          <p class="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Varaa</p>
          <div class="flex flex-row w-full items-center align-middle flex-1">
            <button
              class="w-9 h-9 rounded-xl mr-10 border border-border  flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              @click="router.back()">
              <ArrowLeft :size="16" />
            </button>
            <div class="min-w-0">

              <h1 class="text-lg font-black tracking-tight truncate">{{ item?.name ?? '…' }}</h1>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-5 pb-10">

          <!-- Loading -->
          <div v-if="loading" class="flex flex-col gap-3 pt-4">
            <div class="h-5 w-48 rounded-lg bg-muted animate-pulse" />
            <div class="h-40 w-full rounded-2xl bg-muted animate-pulse" />
          </div>

          <template v-else-if="item">

            <!-- Currently active warning -->
            <div v-if="currentlyActive"
              class="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <Circle :size="10" class="text-amber-500 fill-current shrink-0" />
              <span class="text-sm text-amber-700 font-medium">Tällä hetkellä varattuna</span>
            </div>

            <!-- Success -->
            <div v-if="reserveOk"
              class="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-green-50 border border-green-200 mb-4">
              <CheckCircle2 :size="14" class="text-green-600 shrink-0" />
              <span class="text-sm text-green-700 font-medium">Varaus tehty! Sinut uudelleen ohjataan pian</span>
            </div>

            <!-- Error -->
            <div v-if="reserveErr"
              class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-destructive/5 border border-destructive/20 mb-4">
              <AlertCircle :size="13" class="text-destructive shrink-0" />
              <span class="text-sm text-destructive">{{ reserveErr }}</span>
            </div>

            <!-- Reservation form -->
            <div class="border border-border rounded-2xl overflow-hidden mb-4">

              <!-- Start time -->
              <div class="flex items-center gap-3 px-2 py-3.5 border-b border-border">
                <span class="text-sm text-muted-foreground w-20 shrink-0">Aloitus</span>
                <div class="relative flex-1 min-w-0">
                  <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    @click="alkuDateRef.showPicker()">
                    <CalendarDays :size="13" />
                  </button>
                  <input ref="alkuDateRef" type="date" v-model="alkuDate"
                    class="text-sm border border-border rounded-xl pl-3 pr-2 py-2 bg-background text-foreground outline-none focus:ring-2 focus:ring-ring w-full cursor-pointer" />
                </div>
                <div class="relative w-24 shrink-0">
                  <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    @click="alkuTimeRef.showPicker()">
                    <Timer :size="13" />
                  </button>
                  <input ref="alkuTimeRef" type="time" v-model="alkuTime"
                    class="text-sm border border-border rounded-xl pl-3 pr-2 py-2 bg-background text-foreground outline-none focus:ring-2 focus:ring-ring w-full cursor-pointer" />
                </div>
              </div>

              <!-- End time — only shown when returnRequired -->
              <template v-if="item.returnRequired">
                <div
                  class="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-amber-50/60 dark:bg-amber-900/10">
                  <AlertCircle :size="13" class="text-amber-600 shrink-0" />
                  <div>
                    <p class="text-sm font-medium text-amber-800 dark:text-amber-400">Palautuspäivä vaaditaan</p>
                    <p class="text-xs text-amber-700 dark:text-amber-500">Tämä tavara täytyy palauttaa määrättynä
                      päivänä</p>
                  </div>
                </div>
                <div class="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/20">
                  <span class="text-sm text-muted-foreground w-20 shrink-0">Lopetus</span>
                  <div class="relative flex-1 min-w-0">
                    <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      @click="loppuDateRef.showPicker()">
                      <CalendarDays :size="13" />
                    </button>
                    <input ref="loppuDateRef" type="date" v-model="loppuDate" :min="alkuDate"
                      class="text-sm border border-border rounded-xl pl-3 pr-2 py-2 bg-background text-foreground outline-none focus:ring-2 focus:ring-ring w-full cursor-pointer"
                      :class="validErr && !loppuDate ? 'border-destructive' : ''" />
                  </div>
                  <div class="relative w-24 shrink-0">
                    <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      @click="loppuTimeRef.showPicker()">
                      <Timer :size="13" />
                    </button>
                    <input ref="loppuTimeRef" type="time" v-model="loppuTime"
                      class="text-sm border border-border rounded-xl pl-3 pr-2 py-2 bg-background text-foreground outline-none focus:ring-2 focus:ring-ring w-full cursor-pointer"
                      :class="validErr && !loppuTime ? 'border-destructive' : ''" />
                  </div>
                </div>
              </template>

              <!-- Existing reservations -->
              <div v-if="upcomingReservations.length > 0" class="px-4 py-3 border-b border-border bg-muted/10">
                <p class="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-widest">Olemassaolevat
                  varaukset</p>
                <div class="flex flex-col gap-1.5">
                  <div v-for="r in upcomingReservations" :key="r.id" class="flex items-center gap-2 text-xs">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="r.tila === 1 ? 'bg-amber-500' : 'bg-muted-foreground/40'" />
                    <span class="text-muted-foreground">{{ fmt(r.startedAt) }}
                      – {{ r.returnedAt ? fmt(r.returnedAt) : 'ei ilmoitettu' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Validation error -->
              <div v-if="validErr" class="flex items-center gap-2 px-4 py-3 bg-destructive/5">
                <AlertCircle :size="13" class="text-destructive shrink-0" />
                <span class="text-sm text-destructive">{{ validErr }}</span>
              </div>
            </div>

            <!-- Confirm button -->
            <button
              class="w-full h-14 rounded-2xl bg-foreground text-background text-base font-black uppercase tracking-tight disabled:opacity-40 active:scale-[.98] transition-transform"
              :disabled="reserving" @click="handleReserve">
              {{ reserving ? 'Varataan…' : 'Vahvista varaus' }}
            </button>

          </template>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════
         NORMAL MODE
    ══════════════════════════════════════════ -->
    <template v-else>

      <!-- top bar -->
      <div class="border-b border-border bg-background sticky top-0 z-10">
        <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button
              class="w-7 h-7 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors shrink-0"
              @click="router.back()">
              <ArrowLeft :size="14" />
            </button>
            <span class="text-sm font-medium text-foreground truncate">{{ item?.name ?? 'Ladataan…' }}</span>
          </div>
          <div v-if="isAdmin && item" class="flex items-center gap-2 shrink-0">
            <span v-if="editSuccess" class="text-xs text-emerald-600 flex items-center gap-1">
              <Check :size="12" /> Tallennettu
            </span>
            <button v-if="!editing" @click="startEdit"
              class="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors">
              <Pencil :size="11" /> Muokkaa
            </button>
            <button v-if="!editing" @click="showDeleteConfirm = true"
              class="h-7 px-3 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors">
              <Trash2 :size="11" />
            </button>
            <template v-else>
              <button @click="cancelEdit"
                class="h-7 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Peruuta
              </button>
              <button @click="saveEdit" :disabled="editLoading"
                class="h-7 px-3 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {{ editLoading ? 'Tallennetaan…' : 'Tallenna' }}
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="max-w-2xl mx-auto px-6 py-8">

        <div v-if="loading" class="flex flex-col gap-3">
          <div class="h-6 w-48 rounded-lg bg-muted animate-pulse" />
          <div class="h-4 w-32 rounded-lg bg-muted animate-pulse" />
          <div class="mt-4 h-32 w-full rounded-xl bg-muted animate-pulse" />
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <Package :size="32" class="text-muted-foreground mb-2" />
          <p class="text-sm font-medium">{{ error }}</p>
          <button class="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            @click="router.back()">Takaisin</button>
        </div>

        <template v-else-if="item">

          <!-- Edit form -->
          <div v-if="editing" class="mb-6 flex flex-col gap-3">
            <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-1">Muokkaa tietoja</p>
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Nimi *</label>
              <input v-model="editForm.name" maxlength="128" type="text"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow" />
            </div>
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Tunniste</label>
              <input v-model="editForm.tag" maxlength="16" type="text"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow" />
            </div>
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Huomio</label>
              <textarea v-model="editForm.note" maxlength="255" rows="2"
                class="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow resize-none" />
            </div>
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Tuoteryhmä</label>
              <select v-model="editForm.tuoteryhma_id"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                <option :value="null">— Ei tuoteryhmää —</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>

            <!-- Return required toggle -->
            <div :class="[
              'flex items-center justify-between px-4 py-3 rounded-lg border border-border',
              editForm.return_required ? 'bg-gray-100' : ''
            ]">
              <div>
                <p class="text-sm font-medium">Palautuspäivä vaaditaan</p>
                <p class="text-xs text-muted-foreground">
                  Varaaja pakotetaan antamaan palautusaika
                </p>
              </div>
              
              <button @click="editForm.return_required = !editForm.return_required" :class="['transition-colors rounded-full cursor-pointer h-6', editForm.return_required ? 'bg-green-200' : '' ]">
                <ToggleRight v-if="editForm.return_required" :size="28" class="text-foreground" />
                <ToggleLeft v-else :size="28" class="text-muted-foreground" />
              </button>
            </div>

            <div class="rounded-xl border border-border overflow-hidden">
              <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                <MapPin :size="12" class="text-muted-foreground" />
                <span class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Sijainti</span>
              </div>
              <div class="px-4 py-3 border-b border-border">
                <label class="text-xs text-muted-foreground mb-1 block">Kaappi</label>
                <select v-model="editForm.kaappi_id"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                  <option :value="null">— Ei kaappia —</option>
                  <option v-for="c in cabinets" :key="c.id" :value="c.id">{{ c.warehouse.name }} › {{ c.number }}
                  </option>
                </select>
              </div>
              <div class="px-4 py-3 border-b border-border">
                <label class="text-xs text-muted-foreground mb-1 block">Hylly</label>
                <select v-model="editForm.hylly_id" :disabled="!editForm.kaappi_id"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50">
                  <option :value="null">— Ei hyllyä —</option>
                  <option v-for="s in shelves" :key="s.id" :value="s.id">Hylly {{ s.number }}</option>
                </select>
                <p v-if="!editForm.kaappi_id" class="text-[11px] text-muted-foreground mt-1">Valitse ensin kaappi</p>
              </div>
              <div class="px-4 py-3">
                <label class="text-xs text-muted-foreground mb-1 block">Laatikko</label>
                <select v-model="editForm.laatikko_id"
                  class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow">
                  <option :value="null">— Ei laatikkoa —</option>
                  <option v-for="b in boxes" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
            </div>
            <div v-if="editError"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle :size="12" class="text-destructive shrink-0" />
              <span class="text-xs text-destructive">{{ editError }}</span>
            </div>
          </div>

          <!-- View mode -->
          <template v-else>
            <div class="mb-6">
              <div class="flex items-start justify-between gap-4">
                <h1 class="text-2xl font-medium tracking-tight leading-tight">{{ item.name }}</h1>
                <span
                  class="text-[11px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1 shrink-0 mt-1">#{{
                    item.id }}</span>
              </div>
              <p v-if="item.note" class="text-sm text-muted-foreground mt-1">{{ item.note }}</p>

              <div class="mt-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all active:scale-[.98]"
                    :class="showPicker ? 'border-foreground/20 bg-background text-foreground' : 'border-transparent bg-foreground text-background hover:opacity-90'"
                    @click="showPicker = !showPicker; validErr = null">
                    <BookOpen :size="14" /> Varaa
                  </button>
                  <span v-if="currentlyActive"
                    class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Circle :size="9" class="fill-current" /> Varattuna nyt
                  </span>
                  <span v-if="reserveOk"
                    class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 :size="13" /> Varaus tehty
                  </span>
                  <span v-if="reserveErr" class="text-xs text-destructive">{{ reserveErr }}</span>
                </div>

                <Transition name="cal">
                  <div v-if="showPicker" class="mt-3 border border-border rounded-xl overflow-hidden">

                    <!-- Start time -->
                    <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
                      <span class="text-xs text-muted-foreground w-14 shrink-0">Aloitus</span>
                      <div class="relative flex-1 min-w-0">
                        <button type="button"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          @click="alkuDateRef.showPicker()">
                          <CalendarDays :size="12" />
                        </button>
                        <input ref="alkuDateRef" type="date" v-model="alkuDate"
                          class="text-xs border border-border rounded-md pl-2.5 pr-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring w-full cursor-pointer"
                          :class="validErr && !alkuDate ? 'border-destructive' : ''" />
                      </div>
                      <div class="relative w-24 shrink-0">
                        <button type="button"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          @click="alkuTimeRef.showPicker()">
                          <Timer :size="12" />
                        </button>
                        <input ref="alkuTimeRef" type="time" v-model="alkuTime"
                          class="text-xs border border-border rounded-md pl-2.5 pr-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring w-full cursor-pointer"
                          :class="validErr && !alkuTime ? 'border-destructive' : ''" />
                      </div>
                    </div>

                    <!-- End time — only shown when returnRequired -->
                    <template v-if="item.returnRequired">
                      <div
                        class="flex items-center gap-2 px-4 py-2 border-b border-border bg-amber-50/60 dark:bg-amber-900/10">
                        <AlertCircle :size="12" class="text-amber-600 shrink-0" />
                        <span class="text-xs text-amber-700 dark:text-amber-500">Palautuspäivä vaaditaan</span>
                      </div>
                      <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
                        <span class="text-xs text-muted-foreground w-14 shrink-0">Lopetus</span>
                        <div class="relative flex-1 min-w-0">
                          <button type="button"
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            @click="loppuDateRef.showPicker()">
                            <CalendarDays :size="12" />
                          </button>
                          <input ref="loppuDateRef" type="date" v-model="loppuDate" :min="alkuDate"
                            class="text-xs border border-border rounded-md pl-2.5 pr-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring w-full cursor-pointer"
                            :class="validErr && !loppuDate ? 'border-destructive' : ''" />
                        </div>
                        <div class="relative w-24 shrink-0">
                          <button type="button"
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            @click="loppuTimeRef.showPicker()">
                            <Timer :size="12" />
                          </button>
                          <input ref="loppuTimeRef" type="time" v-model="loppuTime"
                            class="text-xs border border-border rounded-md pl-2.5 pr-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring w-full cursor-pointer"
                            :class="validErr && !loppuTime ? 'border-destructive' : ''" />
                        </div>
                      </div>
                    </template>

                    <div v-if="upcomingReservations.length > 0" class="px-4 py-2.5 border-b border-border bg-muted/20">
                      <p class="text-[11px] text-muted-foreground font-medium mb-1.5">Olemassaolevat varaukset</p>
                      <div class="flex flex-col gap-1">
                        <div v-for="r in upcomingReservations" :key="r.id" class="flex items-center gap-2 text-[11px]">
                          <span class="w-1.5 h-1.5 rounded-full shrink-0"
                            :class="r.tila === 1 ? 'bg-amber-500' : 'bg-muted-foreground/40'" />
                          <span class="text-muted-foreground">{{ fmt(r.startedAt) }} – {{ r.returnedAt ?
                            fmt(r.returnedAt) : 'ei ilmoitettu' }}</span>
                          <span v-if="r.tila === 1" class="text-amber-600 dark:text-amber-400">varattu</span>
                        </div>
                      </div>
                    </div>

                    <div v-if="validErr"
                      class="flex items-center gap-2 px-4 py-2 bg-destructive/5 border-b border-border">
                      <AlertCircle :size="12" class="text-destructive shrink-0" />
                      <span class="text-xs text-destructive">{{ validErr }}</span>
                    </div>
                    <div class="px-4 py-3 flex items-center justify-between gap-3">
                      <button class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        @click="showPicker = false; validErr = null">Peruuta</button>
                      <button
                        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-foreground text-background hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40"
                        :disabled="reserving" @click="handleReserve">
                        <BookOpen :size="12" />
                        <span v-if="reserving">Varataan…</span>
                        <span v-else>Vahvista varaus</span>
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Badges -->
            <div class="flex flex-wrap gap-2 mb-8">
              <span v-if="item.tag"
                class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-foreground text-background">
                <Tag :size="11" />{{ item.tag }}
              </span>
              <span v-if="item.productGroup"
                class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                <Hash :size="11" />{{ item.productGroup.name }}
              </span>
            </div>

            <!-- Location -->
            <div class="grid grid-cols-1 gap-3">
              <div v-if="item.shelf" class="flex flex-col border border-border rounded-xl overflow-hidden">
                <div class="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <MapPin :size="13" class="text-muted-foreground" />
                  <span class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Sijainti</span>
                </div>
                <div class="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground">
                      <Warehouse :size="12" />
                    </div>
                    <span class="text-xs text-muted-foreground">Varasto</span>
                  </div>
                  <span class="text-xs font-medium">{{ item.shelf.cabinet.warehouse.name }}</span>
                </div>
                <div class="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground">
                      <Layers :size="12" />
                    </div>
                    <span class="text-xs text-muted-foreground">Kaappi</span>
                  </div>
                  <span class="text-xs font-medium">{{ item.shelf.cabinet.number }}</span>
                </div>
                <div class="flex items-center justify-between px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground">
                      <Package :size="12" />
                    </div>
                    <span class="text-xs text-muted-foreground">Hylly</span>
                  </div>
                  <span class="text-xs font-medium">{{ item.shelf.number }}</span>
                </div>
              </div>

              <div v-if="item.box" class="flex flex-col border border-border rounded-xl overflow-hidden">
                <div class="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <Box :size="13" class="text-muted-foreground" />
                  <span class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Laatikko</span>
                </div>
                <div class="flex items-center justify-between px-4 py-3">
                  <span class="text-xs text-muted-foreground">Nimi</span>
                  <span class="text-xs font-medium">{{ item.box.name }}</span>
                </div>
              </div>

              <div v-if="!item.shelf && !item.box"
                class="flex items-center gap-3 px-4 py-3 border border-border rounded-xl text-muted-foreground">
                <MapPin :size="14" /><span class="text-xs">Ei sijaintia määritetty</span>
              </div>
            </div>

            <div v-if="item.shelf" class="mt-4 px-4 py-3 bg-muted/40 border border-border rounded-xl">
              <p class="text-[11px] text-muted-foreground">
                {{ item.shelf.cabinet.warehouse.name }}
                <span class="mx-1.5 opacity-40">›</span>
                {{ item.shelf.cabinet.number }}
                <span class="mx-1.5 opacity-40">›</span>
                Hylly {{ item.shelf.number }}
              </p>
            </div>
          </template>

          <!-- Reservation history -->
          <div class="border-t border-border mt-8 mb-5" />
          <div class="flex items-center justify-between mb-3">
            <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Varaushistoria</p>
            <span v-if="reservationsTotal > 0" class="text-[11px] text-muted-foreground">{{ reservationsTotal }}
              varausta</span>
          </div>
          <div v-if="reservationsLoading" class="flex flex-col gap-2">
            <div class="h-12 w-full rounded-lg bg-muted animate-pulse" />
            <div class="h-12 w-full rounded-lg bg-muted animate-pulse" />
          </div>
          <div v-else-if="reservations.length === 0"
            class="flex items-center gap-3 px-4 py-3 border border-border rounded-xl text-muted-foreground">
            <Clock :size="14" /><span class="text-xs">Ei aikaisempia varauksia</span>
          </div>
          <div v-else class="flex flex-col border border-border rounded-xl overflow-hidden">
            <div v-for="(r, i) in reservations" :key="r.id" class="flex items-center justify-between px-4 py-3 text-xs"
              :class="i < reservations.length - 1 ? 'border-b border-border' : ''">
              <div class="flex items-center gap-2.5 min-w-0">
                <Circle v-if="r.tila === 1" :size="13" class="text-amber-500 shrink-0" />
                <CheckCircle2 v-else :size="13" class="text-muted-foreground shrink-0" />
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span class="font-medium truncate">{{ r.user?.name ?? '—' }}</span>
                  <span class="text-muted-foreground">{{ fmt(r.startedAt) }}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                <span class="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  :class="r.tila === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'">
                  {{ r.tila === 1 ? 'Varattu' : 'Palautettu' }}
                </span>
                <span v-if="r.returnedAt" class="text-[10px] text-muted-foreground">{{ fmt(r.returnedAt) }}</span>
              </div>
            </div>
          </div>

          <div class="border-t border-border mt-8 mb-5" />
          <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Varastokartta</p>
          <WarehouseMap v-if="item" :key="item.shelf?.cabinet?.id ?? 'no-cabinet'" :map-src="mapSrc"
            :highlight-cabinet-id="item.shelf?.cabinet?.id ?? null" style="height: 400px;" />

        </template>
      </div>

      <!-- Delete confirm -->
      <Transition name="cal">
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showDeleteConfirm = false" />
          <div
            class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
            <p class="text-sm font-semibold">Poista tavara</p>
            <p class="text-xs text-muted-foreground">Poistetaanko <strong class="text-foreground">{{ item?.name
            }}</strong>
              pysyvästi? Tätä ei voi peruuttaa.</p>
            <div class="flex gap-2 justify-end">
              <button @click="showDeleteConfirm = false"
                class="h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Peruuta
              </button>
              <button @click="doDelete" :disabled="deleteLoading"
                class="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {{ deleteLoading ? 'Poistetaan…' : 'Poista' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

    </template>
  </div>
</template>

<style scoped>
.cal-enter-active,
.cal-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.cal-enter-from,
.cal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.15s, max-height 0.2s;
  max-height: 100px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>