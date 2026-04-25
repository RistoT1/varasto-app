<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { getShelf, deleteShelf, getShelfItems } from '@/api/shelves.js'
import { ArrowLeft, Package, Layers, ArrowRight, Trash2 } from 'lucide-vue-next'

const route   = useRoute()
const router  = useRouter()
const auth    = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

const shelf   = ref(null)
const loading = ref(true)
const error   = ref(null)

const items      = ref([])
const itemsLoading = ref(false)
const pagination = ref({ page: 1, limit: 50, total: 0, pages: 1 })
const page       = ref(1)

const showDelete  = ref(false)
const deleteLoading = ref(false)

async function fetchShelf() {
  loading.value = true
  try {
    const res = await getShelf(route.params.id)
    shelf.value = res.data ?? res
  } catch (e) {
    error.value = e.response?.status === 404 ? 'Hyllyä ei löydy.' : 'Virhe ladattaessa.'
  } finally { loading.value = false }
}

async function fetchItems() {
  itemsLoading.value = true
  try {
    const res = await getShelfItems(route.params.id, { page: page.value })
    items.value = res.data ?? []
    pagination.value = res.pagination ?? { page: 1, limit: 50, total: 0, pages: 1 }
  } catch { items.value = [] }
  finally { itemsLoading.value = false }
}

async function doDelete() {
  deleteLoading.value = true
  try {
    await deleteShelf(route.params.id)
    router.back()
  } catch (e) { console.error(e) }
  finally { deleteLoading.value = false }
}

onMounted(() => Promise.all([fetchShelf(), fetchItems()]))
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
            {{ shelf ? `Hylly ${shelf.Hylly_numero ?? shelf.number}` : 'Ladataan…' }}
          </span>
        </div>
        <button v-if="isAdmin && shelf" @click="showDelete = true"
          class="h-7 px-3 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors shrink-0">
          <Trash2 :size="11"/>
        </button>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-6 py-6">

      <div v-if="loading" class="flex items-center justify-center py-16">
        <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
        </svg>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Layers :size="28" class="opacity-40"/>
        <p class="text-sm">{{ error }}</p>
      </div>

      <template v-else-if="shelf">
        <!-- Shelf info -->
        <div class="rounded-xl border border-border p-4 mb-6 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <Layers :size="16"/>
          </div>
          <div>
            <p class="font-semibold text-sm">Hylly {{ shelf.Hylly_numero ?? shelf.number }}</p>
            <p class="text-xs text-muted-foreground">
              {{ shelf.Varasto_nimi ?? shelf.warehouse?.name }}
              <span v-if="shelf.Kaappi_numero ?? shelf.cabinet?.number"> › Kaappi {{ shelf.Kaappi_numero ?? shelf.cabinet?.number }}</span>
            </p>
          </div>
        </div>

        <!-- Items -->
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">
          Tavarat · {{ pagination.total }}
        </p>

        <div v-if="itemsLoading" class="flex items-center justify-center py-8">
          <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="16" height="16">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"/>
          </svg>
        </div>

        <div v-else-if="!items.length" class="flex items-center gap-3 px-4 py-3 border border-border rounded-xl text-muted-foreground">
          <Package :size="14"/><span class="text-xs">Ei tavaroita tällä hyllyllä</span>
        </div>

        <div v-else class="flex flex-col gap-2">
          <button v-for="item in items" :key="item.id"
            @click="router.push(`/items/${item.id}`)"
            class="group flex items-center justify-between px-4 py-3 border border-border rounded-xl text-left hover:bg-muted/30 transition-colors">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-sm font-medium truncate">{{ item.name }}</span>
              <span v-if="item.productGroup?.name" class="text-xs text-muted-foreground">{{ item.productGroup.name }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span v-if="item.tag" class="text-xs font-mono text-muted-foreground">{{ item.tag }}</span>
              <ArrowRight :size="13" class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
            </div>
          </button>
        </div>

        <div v-if="pagination.pages > 1" class="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>{{ pagination.total }} kpl yhteensä</span>
          <div class="flex gap-1">
            <button :disabled="page === 1" @click="page--; fetchItems()"
              class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40">← Edellinen</button>
            <span class="px-3 py-1.5">{{ page }} / {{ pagination.pages }}</span>
            <button :disabled="page >= pagination.pages" @click="page++; fetchItems()"
              class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40">Seuraava →</button>
          </div>
        </div>
      </template>
    </div>

    <!-- Delete confirm -->
    <Transition name="modal">
      <div v-if="showDelete" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showDelete = false"/>
        <div class="relative z-10 w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          <p class="text-sm font-semibold">Poista hylly</p>
          <p class="text-xs text-muted-foreground">Poistetaanko hylly <strong class="text-foreground">{{ shelf?.Hylly_numero ?? shelf?.number }}</strong> pysyvästi?</p>
          <div class="flex gap-2 justify-end">
            <button @click="showDelete = false" class="h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Peruuta</button>
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