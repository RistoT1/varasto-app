<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { LayoutDashboard, ToolCase, Warehouse, Grid3X3, BookOpen, LogOut, Users } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { logout as logoutApi } from '@/api/auth'

const defaultAvatar = '/images/default-avatar.jpg'
const router = useRouter()
const authStore = useAuthStore()
const expanded = ref(false)

const profileRoute = computed(() => `/profile`)

const kaikkiReitit = computed(() => [
  { to: '/',             label: 'Koti',        icon: LayoutDashboard, adminOnly: false },
  { to: '/items',        label: 'Tavarat',     icon: ToolCase,        adminOnly: false },
  { to: '/warehouses',   label: 'Varastot',    icon: Warehouse,       adminOnly: false },
  { to: '/reservations', label: 'Varaukset',   icon: BookOpen,        adminOnly: false },
  { to: '/map',          label: 'Pohjakartta', icon: Grid3X3,         adminOnly: true  },
  { to: '/users',        label: 'Käyttäjät',   icon: Users,           adminOnly: true  },
])

//suodatetaan reitit käyttöluvan mukaan
const navLinks = computed(() =>
  kaikkiReitit.value.filter(r => !r.adminOnly || authStore.isAdmin)
)

const logout = async () => {
  await logoutApi()
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <!-- ── Desktop sidebar ── -->
  <aside
    class="hidden md:flex fixed top-0 left-0 h-screen z-20 flex-col border-r bg-background transition-all duration-200"
    :class="expanded ? 'w-52' : 'w-12'"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <!-- Avatar → profiili -->
    <div class="flex h-14 items-center px-2 overflow-hidden">
      <RouterLink :to="profileRoute" class="shrink-0">
        <img
          :src="defaultAvatar"
          alt="avatar"
          class="h-8 w-8 rounded-lg object-cover cursor-pointer hover:ring-2 hover:ring-ring transition-all"
        />
      </RouterLink>

      <div
        class="ml-2 overflow-hidden transition-all duration-200"
        :class="expanded ? 'w-36 opacity-100' : 'w-0 opacity-0'"
      >
        <RouterLink :to="profileRoute" class="hover:underline underline-offset-2">
          <p class="truncate text-sm font-semibold leading-tight">
            {{ authStore.user?.username ?? 'Käyttäjä' }}
          </p>
        </RouterLink>
        <p class="truncate text-xs text-muted-foreground">
          {{ authStore.user?.kayttolupa ?? '' }}
        </p>
      </div>
    </div>

    <hr class="border-border" />

    <!-- Navigaatio -->
    <nav class="flex flex-col gap-1 p-2 flex-1" aria-label="Päänavigaatio">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        active-class="text-foreground bg-muted"
        :aria-label="link.label"
      >
        <component :is="link.icon" class="h-4 w-4 shrink-0" />
        <span
          class="overflow-hidden transition-all duration-200 whitespace-nowrap"
          :class="expanded ? 'w-auto opacity-100' : 'w-0 opacity-0'"
        >
          {{ link.label }}
        </span>
      </RouterLink>
    </nav>

    <hr class="border-border" />

    <!-- Kirjaudu ulos -->
    <div class="p-2">
      <button
        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
        @click="logout"
        aria-label="Kirjaudu ulos"
      >
        <LogOut class="h-4 w-4 shrink-0" />
        <span
          class="overflow-hidden transition-all duration-200 whitespace-nowrap"
          :class="expanded ? 'w-auto opacity-100' : 'w-0 opacity-0'"
        >
          Kirjaudu ulos
        </span>
      </button>
    </div>
  </aside>

  <!-- ── Mobiili bottom nav ── -->
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t flex items-center justify-around px-2 h-14"
    aria-label="Mobiilinavigaatio"
  >
    <RouterLink
      v-for="link in navLinks.filter(l => l.to !== '/map')"
      :key="link.to"
      :to="link.to"
      class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground hover:text-foreground transition-colors"
      active-class="text-foreground"
      :aria-label="link.label"
    >
      <component :is="link.icon" class="h-5 w-5" />
      <span class="text-[10px] font-medium">{{ link.label }}</span>
    </RouterLink>

    <!-- Profiili -->
    <RouterLink
      :to="profileRoute"
      class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground hover:text-foreground transition-colors"
      active-class="text-foreground"
      aria-label="Profiili"
    >
      <img
        :src="defaultAvatar"
        alt="avatar"
        class="h-6 w-6 rounded-md object-cover"
      />
      <span class="text-[10px] font-medium">Profiili</span>
    </RouterLink>

    <!-- Kirjaudu ulos -->
    <button
      class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground hover:text-foreground transition-colors"
      @click="logout"
      aria-label="Kirjaudu ulos"
    >
      <LogOut class="h-5 w-5" />
      <span class="text-[10px] font-medium">Ulos</span>
    </button>
  </nav>
</template>