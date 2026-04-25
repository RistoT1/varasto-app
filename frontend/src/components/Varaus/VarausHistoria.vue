<script setup>
import { ref, onMounted, computed } from 'vue'
import { getReservations, closeReservation } from '@/api/reservations'
import { useRouter } from 'vue-router'

const props = defineProps({
    userId: { type: Number, required: true }
})

const router = useRouter()
const reservations = ref([])
const loading = ref(false)
const error = ref(null)
const actionLoading = ref(null)

const page = ref(1)
const limit = 10
const total = ref(0)

const totalPages = computed(() => Math.ceil(total.value / limit))

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fi-FI', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

function isOverdue(r) {
    if (!r.active) return false
    if (!r.returnedAt) return false
    return new Date(r.returnedAt) < new Date()
}

function goToItem(itemId) {
    if (itemId) router.push(`/items/${itemId}`)
}

async function fetchPage(p) {
    loading.value = true
    error.value = null
    try {
        const result = await getReservations({ user_id: props.userId, page: p, limit })
        reservations.value = result.data
        total.value = result.total ?? result.data.length
        page.value = p
    } catch (e) {
        error.value = e?.response?.data?.error ?? 'Virhe varausten haussa'
    } finally {
        loading.value = false
    }
}

async function handleClose(id) {
    try {
        actionLoading.value = id
        await closeReservation(id)
        await fetchPage(page.value)
    } catch (e) {
        error.value = e?.response?.data?.error ?? 'Virhe suljettaessa varausta'
    } finally {
        actionLoading.value = null
    }
}

onMounted(() => fetchPage(1))
</script>

<template>
    <div class="max-w-2xl mx-auto w-full px-6 pb-8">
        <p class="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-3">Varaushistoria</p>

        <div v-if="loading" class="flex items-center justify-center py-10">
            <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                    stroke-dashoffset="12" stroke-linecap="round" />
            </svg>
        </div>

        <div v-else-if="error"
            class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {{ error }}
        </div>

        <div v-else-if="!reservations.length"
            class="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p class="text-sm">Ei varauksia</p>
        </div>

        <div v-else class="flex flex-col gap-3">
            <div v-for="r in reservations" :key="r.id"
                class="rounded-xl border border-border bg-background p-4 flex flex-col gap-3">

                <!-- Top row -->
                <div class="flex items-start justify-between gap-3">
                    <button v-if="r.item" @click="goToItem(r.item.id)"
                        class="flex flex-col gap-0.5 min-w-0 text-left group">
                        <span
                            class="font-medium text-sm truncate group-hover:underline underline-offset-2 transition-colors">
                            {{ r.item.name }}
                        </span>
                        <span v-if="r.item.tag" class="text-xs text-muted-foreground font-mono">{{ r.item.tag }}</span>
                    </button>
                    <span v-else class="text-sm text-muted-foreground">Tuntematon tavara</span>

                    <span :class="[
                        'inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0',
                        isOverdue(r) ? 'bg-red-500/10 text-red-600' :
                            r.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                    ]">
                        <span :class="['w-1.5 h-1.5 rounded-full',
                            isOverdue(r) ? 'bg-red-500' :
                                r.active ? 'bg-emerald-500' : 'bg-muted-foreground/40']" />
                        {{ isOverdue(r) ? 'Myöhässä' : r.active ? 'Aktiivinen' : 'Palautettu' }}
                    </span>
                </div>

                <!-- Location -->
                <div v-if="r.item?.warehouse" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    {{ r.item.warehouse }} › Kaappi {{ r.item.cabinet }} › Hylly {{ r.item.shelf }}
                </div>

                <!-- Dates -->
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                    <div>
                        <p class="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Lainattu</p>
                        <p class="text-xs tabular-nums">{{ formatDate(r.startedAt) }}</p>
                    </div>
                    <div v-if="r.returnedAt">
                        <p class="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Palautettu</p>
                        <p class="text-xs tabular-nums">{{ formatDate(r.returnedAt) }}</p>
                    </div>
                </div>

                <!-- Close button -->
                <button v-if="r.active" @click="handleClose(r.id)" :disabled="actionLoading === r.id"
                    class="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-black text-xs font-medium cursor-pointer text-black hover:text-foreground hover:border-foreground/25 hover:bg-muted/40 transition-all disabled:opacity-40">
                    <svg v-if="actionLoading === r.id" class="animate-spin" width="12" height="12" viewBox="0 0 24 24"
                        fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                            stroke-dashoffset="12" />
                    </svg>
                    <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Merkitse palautetuksi
                </button>

            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex items-center justify-between pt-1">
                <span class="text-xs text-muted-foreground tabular-nums">
                    Sivu {{ page }} / {{ totalPages }}
                </span>
                <div class="flex items-center gap-1">
                    <button
                        @click="fetchPage(page - 1)"
                        :disabled="page <= 1 || loading"
                        class="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <button
                        @click="fetchPage(page + 1)"
                        :disabled="page >= totalPages || loading"
                        class="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>