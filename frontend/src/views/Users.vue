<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getUsers, setUserStatus } from '../api/users'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const self = computed(() => auth.user?.id)
const router = useRouter()
const users = ref([])
const loading = ref(false)
const error = ref(null)

const showChangeStatusBtn = (user) => {
    return user.permission === 'Admin' || user.id === self.value ? false : true
}

const columns = [
    { key: 'id', label: 'ID' },
    { key: 'username', label: 'Nimi' },
    { key: 'permission', label: 'Oikeudet' },
    { key: 'active', label: 'Tila' },
    { key: 'actions', label: '' },
]

const fetchUsers = async () => {
    error.value = null
    loading.value = true
    try {
        users.value = await getUsers()
    } catch (e) {
        error.value = e
        console.error(e)
    } finally {
        loading.value = false
    }
}

async function toggleStatus(user) {
    try {
        const updated = await setUserStatus(user.id, !user.active)
        const found = users.value.find(u => u.id === user.id)
        if (found) found.active = updated.active
    } catch (e) {
        error.value = e.response?.data?.error ?? 'Virhe tilan vaihdossa'
    }
}

//navigoi käyttäjäprofiiliin id:n tai nimen klikkauksesta
function avaaKayttaja(id) {
    router.push(`/users/${id}`)
}

watch(
    () => auth.ready,
    (ready) => {
        if (ready) {
            if (!auth.isAdmin) router.push('/')
            else fetchUsers()
        }
    },
    { immediate: true }
)
</script>

<template>
    <div class="min-h-screen bg-background flex flex-col font-sans">

        <!-- Header -->
        <div class="border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
                <h1 class="text-base font-semibold tracking-tight">Käyttäjät</h1>
                <p class="text-xs text-muted-foreground mt-0.5">Hallitse käyttäjiä ja oikeuksia</p>
            </div>
            <span
                class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-foreground text-background"
                aria-label="Admin-näkymä">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Admin
            </span>
        </div>

        <!-- Lataus -->
        <div v-if="loading" class="flex-1 flex items-center justify-center" role="status" aria-label="Ladataan">
            <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20"
                aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                    stroke-dashoffset="12" stroke-linecap="round" />
            </svg>
        </div>

        <!-- Virhe -->
        <div v-else-if="error" class="px-6 pt-4" role="alert">
            <div class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {{ error }}
            </div>
        </div>

        <!-- Tyhjä -->
        <div v-else-if="!users.length"
            class="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
            </svg>
            <p class="text-sm">Ei käyttäjiä</p>
        </div>

        <!-- Taulukko -->
        <div v-else class="px-6 pt-4 pb-8 overflow-x-auto">
            <table class="w-full text-sm border-collapse" aria-label="Käyttäjälista">
                <thead>
                    <tr class="border-b border-border">
                        <th v-for="col in columns" :key="col.key"
                            class="text-left text-[11px] font-medium text-muted-foreground tracking-widest uppercase pb-2 pr-4 last:pr-0">
                            {{ col.label }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id"
                        class="border-b border-border/50 hover:bg-muted/30 transition-colors">

                        <!-- ID — klikattava -->
                        <td class="py-2.5 pr-4">
                            <button @click="avaaKayttaja(user.id)"
                                class="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors cursor-pointer"
                                :aria-label="`Avaa käyttäjä ${user.username}`">
                                #{{ user.id }}
                            </button>
                        </td>

                        <!-- Nimi — klikattava -->
                        <td class="py-2.5 pr-4">
                            <button @click="avaaKayttaja(user.id)"
                                class="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left"
                                :aria-label="`Avaa käyttäjä ${user.username}`">
                                {{ user.username }}
                            </button>
                        </td>

                        <!-- Oikeudet -->
                        <td class="py-2.5 pr-4">
                            <span :class="[
                                'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full',
                                user.permission === 'Admin'
                                    ? 'bg-foreground/10 text-foreground'
                                    : 'bg-muted text-muted-foreground'
                            ]">
                                {{ user.permission }}
                            </span>
                        </td>

                        <!-- Tila -->
                        <td class="py-2.5 pr-4">
                            <span :class="[
                                'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                                user.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                            ]">
                                <span
                                    :class="['w-1.5 h-1.5 rounded-full', user.active ? 'bg-emerald-500' : 'bg-muted-foreground/50']"
                                    aria-hidden="true" />
                                {{ user.active ? 'Aktiivinen' : 'Ei aktiivinen' }}
                            </span>
                        </td>

                        <!-- Toiminnot -->
                        <td class="py-2.5 whitespace-nowrap">
                            <button v-if="showChangeStatusBtn(user)" @click="toggleStatus(user)" :class="[
                                'text-[13px] cursor-pointer font-medium transition-colors underline-offset-2 hover:underline',
                                user.active
                                    ? 'text-destructive'
                                    : 'text-emerald-600'
                            ]" :aria-label="user.active ? `Deaktivoi ${user.username}` : `Aktivoi ${user.username}`">
                                {{ user.active ? 'Deaktivoi' : 'Aktivoi' }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>