<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { getCabinet, deleteCabinet } from '@/api/cabinets.js'
import { getShelves, createShelf, deleteShelf } from '@/api/shelves.js'
import { ArrowLeft, Layers, Package, Plus, Trash2, AlertCircle, X } from 'lucide-vue-next'

const route   = useRoute()
const router  = useRouter()
const auth    = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

const cabinet = ref(null)
const loading = ref(true)
const error   = ref(null)

const shelves        = ref([])
const shelvesLoading = ref(false)

// ── Create shelf ──
const showCreate   = ref(false)
const createForm   = ref({ number: '' })
const createLoading = ref(false)
const createError  = ref(null)

function sanitize(val) { return String(val ?? '').replace(/<[^>]*>/g, '').trim() }

async function submitCreate() {
  createError.value = null
  const num = sanitize(createForm.value.number)
  if (!num) { createError.value = 'Hyllyn numero on pakollinen.'; return }
  if (num.length > 8) { createError.value = 'Max 8 merkkiä.'; return }
  createLoading.value = true
  try {
    await createShelf({ number: num, kaappi_id: Number(route.params.id) })
    showCreate.value = false
    createForm.value = { number: '' }
    fetchShelves()
  } catch (e) {
    createError.value = e.response?.data?.error ?? 'Luonti epäonnistui.'
  } finally { createLoading.value = false }
}

// ── Delete shelf ──
const deleteShelfTarget  = ref(null)
const deleteShelfLoading = ref(false)

async function doDeleteShelf() {
  deleteShelfLoading.value = true
  try {
    await deleteShelf(deleteShelfTarget.value.ID ?? deleteShelfTarget.value.id)
    deleteShelfTarget.value = null
    fetchShelves()
  } catch (e) { console.error(e) }
  finally { deleteShelfLoading.value = false }
}

// ── Delete cabinet ──
const showDeleteCabinet  = ref(false)
const deleteCabinetLoading = ref(false)

async function doDeleteCabinet() {
  deleteCabinetLoading.value = true
  try {
    await deleteCabinet(route.params.id)
    router.back()
  } catch (e) { console.error(e) }
  finally { deleteCabinetLoading.value = false }
}

async function fetchCabinet() {
  loading.value = true
  try {
    const res = await getCabinet(route.params.id)
    cabinet.value = res.data ?? res
  } catch (e) {
    error.value = e.response?.status === 404 ? 'Kaappia ei löydy.' : 'Virhe ladattaessa.'
  } finally { loading.value = false }
}

async function fetchShelves() {
  shelvesLoading.value = true
  try {
    const res = await getShelves({ kaappi_id: route.params.id })
    shelves.value = Array.isArray(res) ? res : (res.data ?? [])
  } catch { shelves.value = [] }
  finally { shelvesLoading.value = false }
}

onMounted(() => Promise.all([fetchCabinet(), fetchShelves()]))
</script>

<template>
  <div class="min-h-screen bg-background">

    <!-- Top bar -->
    <div class="border-b border-border bg-background sticky top-0 z-10">
      <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button @click="router.back()"
            class="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft :size="14"/>
          </button>
          <span class="text-sm font-medium truncate">
            {{ cabinet ? (cabinet.number ?? cabinet.Kaappi_numero) : 'Ladataan…' }}
          </span>
        </div>
        <div v-if="isAdmin && cabinet" class="flex items-center gap-2 shrink-0">
          <button @click="showCreate = true; createError = null"
            class="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Plus :size="11"/> Hylly
          </button>
          <button @click="showDeleteCabinet = true"
            class="h-7 px-3 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors">
            <Trash2 :size="11"/>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-6 py-6">

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Layers :size="28" class="opacity-40"/>
        <p class="text-sm">{{ error }}</p>
      </div>

      <template v-else-if="cabinet">
        <!-- Cabinet info -->
        <div class="rounded-xl border border-border p-4 mb-6 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <Layers :size="16"/>
          </div>
          <div>
            <p class="font-semibold text-sm">{{ cabinet.number ?? cabinet.Kaappi_numero }}</p>
            <p class="text-xs text-muted-foreground">{{ cabinet.Varasto_nimi ?? cabinet.warehouse?.name }}</p>
          </div>
        </div>

        <!-- Shelves -->
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">
          Hyllyt · {{ shelves.length }}
        </p>

        <div v-if="shelvesLoading" class="flex items-center justify-center py-8">
          <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="16" height="16">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
          </svg>
        </div>

        <div v-else-if="!shelves.length" class="flex items-center gap-3 px-4 py-3 border border-border rounded-xl text-muted-foreground">
          <Layers :size="14"/><span class="text-xs">Ei hyllyjä</span>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div v-for="s in shelves" :key="s.ID ?? s.id"
            class="group flex items-center gap-3 px-4 py-3 border border-border rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
            @click="router.push(`/shelves/${s.ID ?? s.id}`)">
            <div class="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
              <Package :size="12"/>
            </div>
            <span class="text-sm font-medium flex-1">Hylly {{ s.number ?? s.Hylly_numero }}</span>
            <button v-if="isAdmin" @click.stop="deleteShelfTarget = s"
              class="w-7 h-7 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Trash2 :size="11"/>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Create shelf modal -->
    <Transition name="modal">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showCreate = false"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <p class="text-sm font-semibold">Uusi hylly</p>
            <button @click="showCreate = false" class="text-muted-foreground hover:text-foreground"><X :size="16"/></button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-3">
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Hyllyn numero *</label>
              <input v-model="createForm.number" maxlength="8" type="text" placeholder="esim. 1"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow"/>
            </div>
            <div v-if="createError" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle :size="12" class="text-destructive shrink-0"/>
              <span class="text-xs text-destructive">{{ createError }}</span>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-border flex items-center justify-between">
            <button @click="showCreate = false" class="text-xs text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="submitCreate" :disabled="createLoading"
              class="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
              {{ createLoading ? 'Luodaan…' : 'Luo hylly' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete shelf confirm -->
    <Transition name="modal">
      <div v-if="deleteShelfTarget" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="deleteShelfTarget = null"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          <p class="text-sm font-semibold">Poista hylly</p>
          <p class="text-xs text-muted-foreground">Poistetaanko hylly <strong class="text-foreground">{{ deleteShelfTarget.Hylly_numero ?? deleteShelfTarget.number }}</strong> pysyvästi?</p>
          <div class="flex gap-2 justify-end">
            <button @click="deleteShelfTarget = null" class="h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="doDeleteShelf" :disabled="deleteShelfLoading"
              class="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ deleteShelfLoading ? 'Poistetaan…' : 'Poista' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete cabinet confirm -->
    <Transition name="modal">
      <div v-if="showDeleteCabinet" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showDeleteCabinet = false"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          <p class="text-sm font-semibold">Poista kaappi</p>
          <p class="text-xs text-muted-foreground">Poistetaanko kaappi <strong class="text-foreground">{{ cabinet?.Kaappi_numero ?? cabinet?.number }}</strong> pysyvästi?</p>
          <div class="flex gap-2 justify-end">
            <button @click="showDeleteCabinet = false" class="h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="doDeleteCabinet" :disabled="deleteCabinetLoading"
              class="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ deleteCabinetLoading ? 'Poistetaan…' : 'Poista' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>