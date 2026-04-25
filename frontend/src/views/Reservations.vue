<script setup>
import { ref, onMounted, computed } from 'vue'
import { getReservations, closeReservation, deleteReservation } from '@/api/reservations'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const isAdmin = computed(() => auth.isAdmin)

const reservations = ref([])
const activeFilter = ref(undefined)
const page = ref(1)
const limit = ref(50)
const reservationsLoading = ref(false)
const error = ref(null)
const pagination = ref({ page: 1, limit: 50, total: 0, pages: 1 })
const actionLoading = ref(null) // id of reservation currently being acted on

const adminColumns = [
    { key: 'id', label: 'ID' },
    { key: 'item', label: 'Tavara' },
    { key: 'user', label: 'Käyttäjä' },
    { key: 'start', label: 'Alku' },
    { key: 'end', label: 'Loppu' },
    { key: 'location', label: 'Sijainti' },
    { key: 'status', label: 'Tila' },
    { key: 'actions', label: 'Toiminnot' },
]

const columns = isAdmin.value ? adminColumns : null

const fetchReservations = async () => {
    try {
        reservationsLoading.value = true
        error.value = null
        const data = await getReservations({
            active: activeFilter.value,
            page: page.value,
            limit: limit.value
        })
        reservations.value = data.data
        pagination.value = data.pagination
    } catch (e) {
        console.error(e)
        error.value = e.response?.data?.error ?? 'Virhe haettaessa varauksia'
    } finally {
        reservationsLoading.value = false
    }
}

function setFilter(val) {
    activeFilter.value = val
    page.value = 1
    fetchReservations()
}

async function handleClose(id) {
    try {
        actionLoading.value = id
        await closeReservation(id)
        await fetchReservations()
    } catch (e) {
        error.value = e.response?.data?.error ?? 'Virhe suljettaessa varausta'
    } finally {
        actionLoading.value = null
    }
}

async function handleDelete(id) {
    if (!confirm('Poistetaanko varaus pysyvästi?')) return
    try {
        actionLoading.value = id
        await deleteReservation(id)
        await fetchReservations()
    } catch (e) {
        error.value = e.response?.data?.error ?? 'Virhe poistettaessa varausta'
    } finally {
        actionLoading.value = null
    }
}

function goToItem(itemId) {
    if (itemId) router.push(`/items/${itemId}`)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fi-FI', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

function isOverdue(r) {
    const active = r.tila ?? r.active
    if (!active) return false
    if (!r.returnedAt) return false  
    return new Date(r.returnedAt) < new Date()
}

onMounted(async () => {
    if (!auth.ready) await auth.checkAuth()
    fetchReservations()
})

</script>

<template>
    <div class="min-h-screen bg-background flex flex-col font-sans">

        <!-- Header -->
        <div class="border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
                <h1 class="text-base font-semibold tracking-tight">Varaukset</h1>
                <p class="text-xs text-muted-foreground mt-0.5">
                    {{ isAdmin ? 'Kaikki varaukset' : 'Omat varaukset' }}
                </p>
            </div>
            <span v-if="isAdmin"
                class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-foreground text-background">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Admin
            </span>
        </div>

        <!-- Filter tabs -->
        <div class="px-6 pt-4 flex gap-1.5">
            <button v-for="f in [
                { label: 'Kaikki', val: undefined },
                { label: 'Aktiiviset', val: true },
                { label: 'Palautetut', val: false }
            ]" :key="String(f.val)" @click="setFilter(f.val)" :class="[
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeFilter === f.val
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
            ]">
                {{ f.label }}
            </button>
        </div>

        <!-- Loading -->
        <div v-if="reservationsLoading" class="flex-1 flex items-center justify-center">
            <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                    stroke-dashoffset="12" stroke-linecap="round" />
            </svg>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="px-6 pt-4">
            <div class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {{ error }}
            </div>
        </div>

        <!-- Empty -->
        <div v-else-if="!reservations.length"
            class="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p class="text-sm">Ei varauksia</p>
        </div>

        <!-- ── ADMIN: table view ── -->
        <div v-else-if="isAdmin" class="px-6 pt-4 pb-8 overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="border-b border-border">
                        <th v-for="col in columns" :key="col.key"
                            class="text-left text-[11px] font-medium text-muted-foreground tracking-widest uppercase pb-2 pr-4">
                            {{ col.label }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in reservations" :key="r.id"
                        class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td class="py-2.5 pr-4 text-muted-foreground font-mono text-xs">#{{ r.id }}</td>
                        <td class="py-2.5 pr-4">
                            <button v-if="r.item" @click="goToItem(r.item.id)"
                                class="flex items-center gap-1.5 group hover:text-primary transition-colors text-left">
                                <span class="font-medium group-hover:underline underline-offset-2">{{ r.item.name
                                }}</span>
                                <span v-if="r.item.tag" class="text-xs text-muted-foreground font-mono">{{ r.item.tag
                                }}</span>
                                <svg class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" width="11"
                                    height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </button>
                            <span v-else class="text-muted-foreground">—</span>
                        </td>
                        <td class="py-2.5 pr-4">
                            <button v-if="r.user"
                                @click="r.user.id === auth.user?.id ? router.push('/profile') : router.push(`/users/${r.user.id}`)"
                                class="text-sm hover:underline underline-offset-2 transition-colors hover:text-foreground text-muted-foreground">
                                {{ r.user.name }}
                            </button>
                            <span v-else class="text-muted-foreground">—</span>
                        </td>
                        <td class="py-2.5 pr-4 text-xs text-muted-foreground tabular-nums">{{ formatDate(r.startedAt) }}
                        </td>
                        <td class="py-2.5 pr-4 text-xs text-muted-foreground tabular-nums">{{ formatDate(r.returnedAt)
                        }}</td>
                        <td class="py-2.5 pr-4 text-xs text-muted-foreground">
                            <span v-if="r.item?.warehouse">{{ r.item.warehouse }} › K{{ r.item.cabinet }} › H{{
                                r.item.shelf }}</span>
                            <span v-else>—</span>
                        </td>
                        <td class="py-2.5 pr-4">
                            <span :class="[
                                'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                                isOverdue(r) ? 'bg-red-500/10 text-red-600' :
                                    r.tila ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                            ]">
                                <span :class="['w-1.5 h-1.5 rounded-full',
                                    isOverdue(r) ? 'bg-red-500' :
                                        r.tila ? 'bg-emerald-500' : 'bg-muted-foreground/50']" />
                                {{ isOverdue(r) ? 'Myöhässä' : r.tila ? 'Aktiivinen' : 'Palautettu' }}
                            </span>
                        </td>
                        <td class="py-2.5">
                            <div class="flex items-center gap-1.5">
                                <button v-if="r.active" @click="handleClose(r.id)" :disabled="actionLoading === r.id"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
                                    <svg v-if="actionLoading === r.id" class="animate-spin" width="10" height="10"
                                        viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
                                            stroke-dasharray="32" stroke-dashoffset="12" />
                                    </svg>
                                    <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Sulje
                                </button>
                                <button @click="handleDelete(r.id)" :disabled="actionLoading === r.id"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all disabled:opacity-40">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                        <path d="M10 11v6M14 11v6" />
                                    </svg>
                                    Poista
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Pagination -->
            <div class="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                <span>{{ pagination.total }} varaukset yhteensä</span>
                <div class="flex gap-1">
                    <button :disabled="page === 1" @click="page--; fetchReservations()"
                        class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40 hover:bg-muted/60 transition-colors">←
                        Edellinen</button>
                    <span class="px-3 py-1.5">{{ page }} / {{ pagination.pages }}</span>
                    <button :disabled="page >= pagination.pages" @click="page++; fetchReservations()"
                        class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40 hover:bg-muted/60 transition-colors">Seuraava
                        →</button>
                </div>
            </div>
        </div>

        <!-- ── USER: card view ── -->
        <div v-else class="px-6 pt-4 pb-8 flex flex-col gap-3 max-w-2xl mx-auto w-full">
            <div v-for="r in reservations" :key="r.id"
                class="rounded-xl border border-border bg-background p-4 flex flex-col gap-3">
                <!-- Top row -->
                <div class="flex items-start justify-between gap-3">
                    <button v-if="r.item" @click="goToItem(r.item.id)"
                        class="flex flex-col gap-0.5 min-w-0 text-left group">
                        <span
                            class="font-medium text-sm truncate group-hover:underline underline-offset-2 transition-colors">{{
                                r.item.name }}</span>
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
            <div class="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{{ pagination.total }} varaukset yhteensä</span>
                <div class="flex gap-1">
                    <button :disabled="page === 1" @click="page--; fetchReservations()"
                        class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40">← Edellinen</button>
                    <span class="px-3 py-1.5">{{ page }} / {{ pagination.pages }}</span>
                    <button :disabled="page >= pagination.pages" @click="page++; fetchReservations()"
                        class="px-3 py-1.5 rounded-lg bg-muted disabled:opacity-40">Seuraava →</button>
                </div>
            </div>
        </div>

    </div>
</template>