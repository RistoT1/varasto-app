<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/api/warehouses.js'
import { Warehouse, ChevronRight, X, AlertCircle, Pencil, Trash2, Plus } from 'lucide-vue-next'

const router  = useRouter()
const auth    = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

const warehouses = ref([])
const loading    = ref(false)

async function fetchWarehouses() {
  loading.value = true
  try {
    const res = await getWarehouses()
    warehouses.value = Array.isArray(res) ? res : (res.data ?? [])
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function sanitize(val) { return String(val ?? '').replace(/<[^>]*>/g, '').trim() }

// ── Create warehouse ──
const showCreate    = ref(false)
const createName    = ref('')
const createLoading = ref(false)
const createError   = ref(null)

async function submitCreate() {
  createError.value = null
  const name = sanitize(createName.value)
  if (!name) { createError.value = 'Nimi on pakollinen.'; return }
  if (name.length > 64) { createError.value = 'Nimi max 64 merkkiä.'; return }
  createLoading.value = true
  try {
    await createWarehouse(name)
    showCreate.value = false
    createName.value = ''
    fetchWarehouses()
  } catch (e) {
    createError.value = e.response?.data?.error ?? 'Luonti epäonnistui.'
  } finally { createLoading.value = false }
}

// ── Edit warehouse ──
const editTarget  = ref(null)
const editName    = ref('')
const editLoading = ref(false)
const editError   = ref(null)

function startEdit(w) {
  editTarget.value = w
  editName.value   = w.name
  editError.value  = null
}

async function submitEdit() {
  editError.value = null
  const name = sanitize(editName.value)
  if (!name) { editError.value = 'Nimi on pakollinen.'; return }
  editLoading.value = true
  try {
    await updateWarehouse(editTarget.value.id, name)
    editTarget.value = null
    fetchWarehouses()
  } catch (e) {
    editError.value = e.response?.data?.error ?? 'Tallennus epäonnistui.'
  } finally { editLoading.value = false }
}

// ── Delete warehouse ──
const deleteTarget  = ref(null)
const deleteLoading = ref(false)

async function doDelete() {
  deleteLoading.value = true
  try {
    await deleteWarehouse(deleteTarget.value.id)
    deleteTarget.value = null
    fetchWarehouses()
  } catch (e) { console.error(e) }
  finally { deleteLoading.value = false }
}

onMounted(fetchWarehouses)
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">

    <!-- Header -->
    <div class="border-b border-border px-6 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold tracking-tight">Varastot</h1>
        <p class="text-xs text-muted-foreground mt-0.5">{{ warehouses.length }} varastoa</p>
      </div>
      <button v-if="isAdmin" @click="showCreate = true; createError = null; createName = ''"
        class="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity">
        <Plus :size="13"/> Uusi varasto
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
      </svg>
    </div>

    <div v-else class="px-6 pt-5 pb-8 max-w-2xl mx-auto w-full flex flex-col gap-2">

      <div v-for="w in warehouses" :key="w.id"
        class="border border-border rounded-xl overflow-hidden">

        <div class="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
          @click="router.push(`/warehouses/${w.id}`)">
          <div class="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <Warehouse :size="14"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ w.name }}</p>
            <p class="text-xs text-muted-foreground">{{ w.cabinetCount ?? 0 }} kaappia · {{ w.shelfCount ?? 0 }} hyllyä</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <template v-if="isAdmin">
              <button @click.stop="startEdit(w)"
                class="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors flex items-center justify-center">
                <Pencil :size="11"/>
              </button>
              <button @click.stop="deleteTarget = w"
                class="w-7 h-7 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors flex items-center justify-center">
                <Trash2 :size="11"/>
              </button>
            </template>
            <ChevronRight :size="14" class="text-muted-foreground"/>
          </div>
        </div>
      </div>
    </div>

    <!-- Create warehouse modal -->
    <Transition name="modal">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showCreate = false"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <p class="text-sm font-semibold">Uusi varasto</p>
            <button @click="showCreate = false" class="text-muted-foreground hover:text-foreground"><X :size="16"/></button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-3">
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Nimi *</label>
              <input v-model="createName" maxlength="64" type="text" placeholder="esim. TS06"
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
              class="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ createLoading ? 'Luodaan…' : 'Luo varasto' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Edit warehouse modal -->
    <Transition name="modal">
      <div v-if="editTarget" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="editTarget = null"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <p class="text-sm font-semibold">Muokkaa varastoa</p>
            <button @click="editTarget = null" class="text-muted-foreground hover:text-foreground"><X :size="16"/></button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-3">
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Nimi *</label>
              <input v-model="editName" maxlength="64" type="text"
                class="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow"/>
            </div>
            <div v-if="editError" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle :size="12" class="text-destructive shrink-0"/>
              <span class="text-xs text-destructive">{{ editError }}</span>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-border flex items-center justify-between">
            <button @click="editTarget = null" class="text-xs text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="submitEdit" :disabled="editLoading"
              class="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ editLoading ? 'Tallennetaan…' : 'Tallenna' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete warehouse confirm -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="deleteTarget = null"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          <p class="text-sm font-semibold">Poista varasto</p>
          <p class="text-xs text-muted-foreground">Poistetaanko <strong class="text-foreground">{{ deleteTarget.name }}</strong> pysyvästi?</p>
          <div class="flex gap-2 justify-end">
            <button @click="deleteTarget = null" class="h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Peruuta</button>
            <button @click="doDelete" :disabled="deleteLoading"
              class="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90">
              {{ deleteLoading ? 'Poistetaan…' : 'Poista' }}
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