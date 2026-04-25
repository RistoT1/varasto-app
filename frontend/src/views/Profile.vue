<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getUser, changePassword, setUserStatus, deleteUser } from '@/api/users'
import VarausHistoria from '@/components/Varaus/VarausHistoria.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')
const profileId = computed(() => route.params.id ? Number(route.params.id) : auth.user?.id)
const isSelf = computed(() => profileId.value === auth.user?.id)

const user = ref(null)
const loading = ref(false)
const error = ref(null)

// password change
const pwForm = ref({ password: '', confirm: '' })
const pwLoading = ref(false)
const pwError = ref(null)
const pwSuccess = ref(false)

// status toggle
const statusLoading = ref(false)

// delete
const deleteConfirm = ref(false)
const deleteLoading = ref(false)

async function fetchUser() {
  loading.value = true
  error.value = null
  try {
    user.value = await getUser(profileId.value)
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Käyttäjää ei löydy'
  } finally {
    loading.value = false
  }
}

async function submitPassword() {
  pwError.value = null
  pwSuccess.value = false
  if (pwForm.value.password.length < 6) {
    pwError.value = 'Salasanan tulee olla vähintään 6 merkkiä'
    return
  }
  if (pwForm.value.password !== pwForm.value.confirm) {
    pwError.value = 'Salasanat eivät täsmää'
    return
  }
  pwLoading.value = true
  try {
    await changePassword(profileId.value, pwForm.value.password)
    pwSuccess.value = true
    pwForm.value = { password: '', confirm: '' }
  } catch (e) {
    pwError.value = e.response?.data?.error ?? 'Virhe salasanan vaihdossa'
  } finally {
    pwLoading.value = false
  }
}

async function toggleStatus() {
  statusLoading.value = true
  try {
    const updated = await setUserStatus(profileId.value, !user.value.active)
    user.value.active = updated.active
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Virhe tilan vaihdossa'
  } finally {
    statusLoading.value = false
  }
}

async function confirmDelete() {
  deleteLoading.value = true
  try {
    await deleteUser(profileId.value)
    router.push('/users')
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Virhe poistossa'
    deleteConfirm.value = false
  } finally {
    deleteLoading.value = false
  }
}

onMounted(fetchUser)
</script>

<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <div class="border-b border-border px-6 py-4 flex items-center gap-3">
      <button @click="router.back()"
        class="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>
      <div>
        <h1 class="text-base font-semibold tracking-tight">
          {{ isSelf ? 'Oma profiili' : 'Käyttäjäprofiili' }}
        </h1>
        <p class="text-xs text-muted-foreground">{{ user?.username ?? '…' }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" width="20" height="20">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
          stroke-dashoffset="12" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="error && !user" class="px-6 pt-6 max-w-lg">
      <div class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {{ error }}
      </div>
    </div>

    <div v-else-if="user" class="max-w-lg mx-auto px-6 py-6 flex flex-col gap-5">

      <!-- Identity card -->
      <div class="rounded-xl border border-border bg-background p-5 flex items-center gap-4">
        <!-- Avatar initials -->
        <div
          class="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-base font-semibold text-foreground shrink-0 select-none">
          {{ user.username?.slice(0, 2).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm">{{ user.username }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">ID #{{ user.id }}</p>
        </div>
        <div class="flex flex-col items-end gap-1.5">
          <span :class="[
            'inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full',
            user.permission === 'Admin' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
          ]">
            <svg v-if="user.permission === 'Admin'" width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {{ user.permission ?? 'Käyttäjä' }}
          </span>
          <span :class="[
            'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
            user.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
          ]">
            <span :class="['w-1.5 h-1.5 rounded-full', user.active ? 'bg-emerald-500' : 'bg-muted-foreground/50']" />
            {{ user.active ? 'Aktiivinen' : 'Ei aktiivinen' }}
          </span>
        </div>
      </div>

      <!-- Change password -->
      <div class="rounded-xl border border-border bg-background p-5">
        <p class="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-4">Vaihda salasana</p>

        <div class="flex flex-col gap-2.5">
          <input v-model="pwForm.password" type="password" placeholder="Uusi salasana"
            class="w-full h-10 px-3.5 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow placeholder:text-muted-foreground" />
          <input v-model="pwForm.confirm" type="password" placeholder="Vahvista salasana"
            class="w-full h-10 px-3.5 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring transition-shadow placeholder:text-muted-foreground" />

          <div v-if="pwError" class="text-xs text-destructive px-1">{{ pwError }}</div>
          <div v-if="pwSuccess" class="text-xs text-emerald-600 px-1">Salasana vaihdettu ✓</div>

          <button @click="submitPassword" :disabled="pwLoading"
            class="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
            {{ pwLoading ? 'Vaihdetaan…' : 'Vaihda salasana' }}
          </button>
        </div>
      </div>

      <!-- Admin actions -->
      <div v-if="isAdmin && !isSelf" class="rounded-xl border border-border bg-background p-5">
        <p class="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-4">Admin-toiminnot</p>

        <div class="flex flex-col gap-10 mt-5">
          <div class="flex flex-col gap-2.5">
            <h2>Deaktivoi käyttäjä</h2>
            <button @click="toggleStatus" :disabled="statusLoading"
              class="h-10 px-4 rounded-lg bg-foreground cursor-pointer text-background text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
              <span>{{ user.active ? 'Deaktivoi käyttäjä' : 'Aktivoi käyttäjä' }}</span>
              <svg v-if="statusLoading" class="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none"
                width="14" height="14">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
                  stroke-dashoffset="12" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <!-- Delete -->
          <div v-if="!deleteConfirm">
            <h2>Poista käyttäjä</h2>
            <button @click="deleteConfirm = true"
              class="h-10 px-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors w-full">
              Poista käyttäjä
            </button>
          </div>
          <div v-else class="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 flex flex-col gap-2.5">
            <p class="text-xs text-destructive">Poistetaanko käyttäjä <strong>{{ user.username }}</strong> pysyvästi?
            </p>
            <div class="flex gap-2">
              <button @click="deleteConfirm = false"
                class="flex-1 h-9 rounded-lg bg-muted border border-border text-sm font-medium hover:bg-muted/60 transition-colors">Peruuta</button>
              <button @click="confirmDelete" :disabled="deleteLoading"
                class="flex-1 h-9 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {{ deleteLoading ? 'Poistetaan…' : 'Poista' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
    <VarausHistoria v-if="user" :userId="user.id" />
  </div>
</template>