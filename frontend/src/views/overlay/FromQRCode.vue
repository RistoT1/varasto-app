<script setup>
import { useQrCodePanelStore } from '@/stores/useQrCodePanelStore'
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'

const qrStore = useQrCodePanelStore()
const router = useRouter()
const route = useRoute()

const QR_ROUTES = ['/warehouses', '/cabinets', '/shelves', '/items']

const isQrRoute = computed(() =>
  QR_ROUTES.some(r => route.path.startsWith(r))
)

function onVaraa() {
  const newQuery = { ...route.query }
  delete newQuery.FQR
  newQuery.Varaa = '1'

  if (isQrRoute.value) {
    router.replace({ path: route.path, query: newQuery })
  } else {
    router.push({ path: '/items', query: newQuery })
  }
  qrStore.closePanel()
}

function onClose() {
  qrStore.closePanel()
  const newQuery = { ...route.query }
  delete newQuery.FQR
  router.replace({ path: route.path, query: newQuery })
}


function onPalauta() {
  router.push('/reservations')
}

function onNormaaliNakyma() {
  onClose()
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    leave-active-class="transition-opacity duration-200 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="qrStore.open"
      class="fixed inset-0 z-50 bg-stone-100"
      @click.self="onClose"
    >
      <div class="relative flex h-full w-full flex-col items-center justify-center gap-6 px-8 py-10">

        <!-- Close -->
        <button
          class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-sm border border-neutral-900 text-neutral-900 transition-colors duration-150 hover:bg-neutral-900 hover:text-stone-100"
          aria-label="Sulje"
          @click="onClose"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- QR content area -->
        <div class="flex w-full max-w-sm justify-center">
          <slot>
            <div class="flex h-24 w-24 items-center justify-center text-neutral-900 opacity-25">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="3" stroke="currentColor" stroke-width="2.5"/>
                <rect x="8" y="8" width="12" height="12" rx="1" fill="currentColor"/>
                <rect x="38" y="2" width="24" height="24" rx="3" stroke="currentColor" stroke-width="2.5"/>
                <rect x="44" y="8" width="12" height="12" rx="1" fill="currentColor"/>
                <rect x="2" y="38" width="24" height="24" rx="3" stroke="currentColor" stroke-width="2.5"/>
                <rect x="8" y="44" width="12" height="12" rx="1" fill="currentColor"/>
                <rect x="38" y="38" width="10" height="10" rx="1" fill="currentColor"/>
                <rect x="52" y="38" width="10" height="10" rx="1" fill="currentColor"/>
                <rect x="38" y="52" width="10" height="10" rx="1" fill="currentColor"/>
              </svg>
            </div>
          </slot>
        </div>

        <!-- Action buttons -->
        <div class="flex w-full max-w-sm flex-col gap-3">
          <button
            class="flex items-center justify-center rounded-sm border-2 border-neutral-900 bg-neutral-900 px-5 py-5 text-xl font-black uppercase tracking-tight text-stone-100 transition-all duration-100 hover:-translate-x-px hover:-translate-y-px cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            @click="onVaraa"
          >
            <span>Varaa</span>
          </button>

          <button
            class="flex items-center justify-center rounded-sm border-2 border-neutral-900 bg-stone-100 px-5 py-5 text-xl font-black uppercase tracking-tight text-neutral-900 transition-all duration-100 hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 cursor-pointer active:shadow-none"
            @click="onPalauta"
          >
            <span>Palauta</span>
          </button>
        </div>

        <!-- Secondary link -->
        <button
          class="bg-transparent px-2 py-1 font-mono text-xs font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 transition-colors duration-150 hover:text-neutral-900 hover:decoration-neutral-900"
          @click="onNormaaliNakyma"
        >
          normaali näkymä
        </button>

      </div>
    </div>
  </Transition>
</template>