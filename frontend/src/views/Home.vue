<script setup>
import { ref, computed } from 'vue'
import {
  Search, Package, Warehouse, BookOpen,
  Users, Upload, Download, ShieldCheck, ArrowRight,
  Grid3X3, QrCode
} from 'lucide-vue-next'
import { searchAll } from '@/api/search.js'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import WarehouseMap from '@/components/VarastoPohjakartta/WarehouseMap.vue'
import jsQR from 'jsqr'

const router = useRouter()
const auth = useAuthStore()
const isAdmin = computed(() => auth.user?.kayttolupa === 'Admin')

const query = ref('')
const results = ref(null)
const isLoading = ref(false)
const isFocused = ref(false)
const qrError = ref(null)

let debounceTimer = null
let abortController = null

function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => doSearch(query.value), 300)
}

async function doSearch(q) {
  if (abortController) abortController.abort()
  if (q.trim().length < 3) { results.value = null; return }
  abortController = new AbortController()
  isLoading.value = true
  try {
    results.value = await searchAll({ query: q, limit: 20, signal: abortController.signal })
  } catch (e) {
    if (e.name !== 'AbortError' && e.name !== 'CanceledError') console.error(e)
  } finally {
    isLoading.value = false
  }
}

function onFocusOut(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return
  isFocused.value = false
}

// ── QR camera ────────────────────────────────────────────────────────────────
function openCamera() {
  qrError.value = null

  if (!navigator.mediaDevices?.getUserMedia) {
    qrError.value = 'Kamera ei ole tuettu tässä selaimessa'
    return
  }

  // Build a hidden but rendered video + canvas (must be in DOM on mobile)
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;'

  const video = document.createElement('video')
  video.setAttribute('playsinline', '')   // critical for iOS Safari
  video.setAttribute('muted', '')
  video.muted = true
  video.style.cssText = 'width:100%;max-width:500px;border-radius:8px;'

  const canvas = document.createElement('canvas')
  canvas.style.display = 'none'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕ Sulje'
  closeBtn.style.cssText = 'margin-top:16px;padding:10px 24px;background:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;'

  const hint = document.createElement('p')
  hint.textContent = 'Osoita QR-koodiin'
  hint.style.cssText = 'color:#fff;margin-top:12px;font-size:14px;'

  container.append(video, canvas, hint, closeBtn)
  document.body.appendChild(container)

  let stream = null
  let scanInterval = null

  function cleanup() {
    clearInterval(scanInterval)
    stream?.getTracks().forEach(t => t.stop())
    container.remove()
  }

  closeBtn.addEventListener('click', cleanup)

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
    .then(s => {
      stream = s
      video.srcObject = s

      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => {
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          const ctx = canvas.getContext('2d')

          scanInterval = setInterval(() => {
            if (video.readyState < 2) return
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, canvas.width, canvas.height)

            if (code) {
              cleanup()
              const appBase = window.location.origin
              if (code.data.startsWith(appBase)) {
                const url = new URL(code.data)
                if (url.searchParams.get('FQR') === '1') {
                  url.searchParams.delete('FQR')
                  url.searchParams.set('Varaa', '1')
                }
                const cleanPath =
                  url.pathname +
                  (url.search || '') +
                  (url.hash || '')
                router.push(cleanPath)
              } else {
                qrError.value = 'Tuntematon QR-koodi'
              }
            }
          }, 200)
        }).catch(() => {
          cleanup()
          qrError.value = 'Videon toisto epäonnistui'
        })
      })
    })
    .catch(err => {
      cleanup()
      qrError.value = err.name === 'NotAllowedError'
        ? 'Kameran käyttö estetty – tarkista selain- ja käyttöoikeusasetukset'
        : 'Kameraa ei voitu avata'
    })
}
const hasResults = computed(() => results.value && results.value.total > 0)
const noResults = computed(() =>
  results.value?.total === 0 && query.value.trim().length >= 3
)

const SECTIONS = [
  { key: 'items', label: 'Tavarat' },
  { key: 'warehouses', label: 'Varastot' },
  { key: 'cabinets', label: 'Kaapit' },
  { key: 'shelves', label: 'Hyllyt' },
  { key: 'boxes', label: 'Laatikot' },
  { key: 'productGroups', label: 'Tuoteryhmät' },
]

function sectionData(key) { return results.value?.[key]?.data ?? [] }
function sectionTotal(key) { return results.value?.[key]?.total ?? 0 }

function itemBreadcrumb(item) {
  const p = []
  if (item.shelf?.cabinet?.warehouse?.name) p.push(item.shelf.cabinet.warehouse.name)
  if (item.shelf?.cabinet?.number) p.push(item.shelf.cabinet.number)
  if (item.shelf?.number) p.push(`Hylly ${item.shelf.number}`)
  return p.join(' › ')
}

const userCards = [
  { title: 'Tavarat', desc: 'Selaa inventaariota', icon: Package, route: '/items' },
  { title: 'Varastot', desc: 'Varastot ja hyllypaikat', icon: Warehouse, route: '/warehouses' },
  { title: 'Varaukset', desc: 'Omat aktiiviset varaukset', icon: BookOpen, route: '/reservations' },
]

const Hero = [
  { title: 'Hae Tavaroita', desc: 'Selaa inventaariota', icon: Package, route: '/items' },
  { title: 'Skannaa QR-koodi', desc: 'Avaa kamera', icon: QrCode, action: openCamera },
]

const adminCards = [
  { title: 'Tavarat', desc: 'Selaa ja hallinnoi', icon: Package, route: '/items' },
  { title: 'Varastot', desc: 'Rakenne ja kaapit', icon: Warehouse, route: '/warehouses' },
  { title: 'Varaukset', desc: 'Kaikki aktiiviset lainat', icon: BookOpen, route: '/reservations' },
  { title: 'Käyttäjät', desc: 'Hallinnoi käyttölupia', icon: Users, route: '/users' },
  { title: 'Pohjakartta', desc: 'hallinnoi hyllyjä kartalla', icon: Grid3X3, route: '/map' },
]

const importExportCards = [
  { title: 'Tuo CSV', desc: 'Bulk-tuonti tiedostosta', icon: Upload, route: '/import' },
  { title: 'Vie JSON/CSV', desc: 'Varmuuskopio tai siirto', icon: Download, route: '/export' },
]
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">

    <!-- HERO -->
    <div class="relative overflow-hidden h-82 bg-muted border-b border-border shrink-0">
      <svg class="absolute inset-0 w-full h-full text-foreground" viewBox="0 0 1200 380"
        preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="0" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="199" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="399" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="599" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="799" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="999" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="1197" y="0" width="3" height="280" fill="currentColor" opacity=".06" />
        <rect x="8" y="14" width="42" height="56" rx="2" fill="currentColor" opacity=".08" />
        <rect x="54" y="22" width="30" height="48" rx="2" fill="currentColor" opacity=".06" />
        <rect x="88" y="8" width="50" height="62" rx="2" fill="currentColor" opacity=".09" />
        <rect x="142" y="18" width="34" height="52" rx="2" fill="currentColor" opacity=".07" />
        <rect x="206" y="10" width="56" height="60" rx="2" fill="currentColor" opacity=".09" />
        <rect x="266" y="20" width="38" height="50" rx="2" fill="currentColor" opacity=".07" />
        <rect x="308" y="5" width="58" height="65" rx="2" fill="currentColor" opacity=".08" />
        <rect x="370" y="15" width="28" height="55" rx="2" fill="currentColor" opacity=".06" />
        <rect x="402" y="12" width="46" height="58" rx="2" fill="currentColor" opacity=".09" />
        <rect x="452" y="20" width="32" height="50" rx="2" fill="currentColor" opacity=".07" />
        <rect x="488" y="6" width="54" height="64" rx="2" fill="currentColor" opacity=".08" />
        <rect x="546" y="16" width="40" height="54" rx="2" fill="currentColor" opacity=".07" />
        <rect x="590" y="4" width="62" height="66" rx="2" fill="currentColor" opacity=".09" />
        <rect x="656" y="14" width="34" height="56" rx="2" fill="currentColor" opacity=".06" />
        <rect x="694" y="10" width="50" height="60" rx="2" fill="currentColor" opacity=".08" />
        <rect x="748" y="6" width="56" height="64" rx="2" fill="currentColor" opacity=".09" />
        <rect x="808" y="18" width="30" height="52" rx="2" fill="currentColor" opacity=".06" />
        <rect x="842" y="8" width="48" height="62" rx="2" fill="currentColor" opacity=".08" />
        <rect x="894" y="16" width="38" height="54" rx="2" fill="currentColor" opacity=".07" />
        <rect x="936" y="4" width="56" height="66" rx="2" fill="currentColor" opacity=".09" />
        <rect x="996" y="14" width="36" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="1036" y="6" width="52" height="64" rx="2" fill="currentColor" opacity=".08" />
        <rect x="1092" y="18" width="32" height="52" rx="2" fill="currentColor" opacity=".06" />
        <rect x="1128" y="8" width="58" height="62" rx="2" fill="currentColor" opacity=".09" />
        <rect x="8" y="84" width="50" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="62" y="90" width="36" height="50" rx="2" fill="currentColor" opacity=".06" />
        <rect x="102" y="78" width="52" height="62" rx="2" fill="currentColor" opacity=".08" />
        <rect x="158" y="88" width="30" height="52" rx="2" fill="currentColor" opacity=".06" />
        <rect x="202" y="80" width="34" height="60" rx="2" fill="currentColor" opacity=".07" />
        <rect x="240" y="76" width="62" height="64" rx="2" fill="currentColor" opacity=".09" />
        <rect x="306" y="86" width="40" height="54" rx="2" fill="currentColor" opacity=".07" />
        <rect x="350" y="78" width="48" height="62" rx="2" fill="currentColor" opacity=".08" />
        <rect x="402" y="84" width="40" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="446" y="76" width="90" height="64" rx="2" fill="currentColor" opacity=".06" />
        <rect x="540" y="74" width="60" height="66" rx="2" fill="currentColor" opacity=".09" />
        <rect x="604" y="84" width="38" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="646" y="76" width="54" height="64" rx="2" fill="currentColor" opacity=".09" />
        <rect x="704" y="86" width="32" height="54" rx="2" fill="currentColor" opacity=".06" />
        <rect x="740" y="78" width="56" height="62" rx="2" fill="currentColor" opacity=".08" />
        <rect x="800" y="84" width="44" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="848" y="76" width="58" height="64" rx="2" fill="currentColor" opacity=".09" />
        <rect x="910" y="86" width="36" height="54" rx="2" fill="currentColor" opacity=".06" />
        <rect x="950" y="78" width="50" height="62" rx="2" fill="currentColor" opacity=".08" />
        <rect x="1004" y="84" width="42" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="1050" y="74" width="60" height="66" rx="2" fill="currentColor" opacity=".09" />
        <rect x="1114" y="82" width="38" height="58" rx="2" fill="currentColor" opacity=".07" />
        <rect x="1156" y="76" width="40" height="64" rx="2" fill="currentColor" opacity=".08" />
        <rect x="8" y="156" width="46" height="52" rx="2" fill="currentColor" opacity=".07" />
        <rect x="58" y="162" width="32" height="46" rx="2" fill="currentColor" opacity=".06" />
        <rect x="94" y="150" width="54" height="58" rx="2" fill="currentColor" opacity=".08" />
        <rect x="152" y="160" width="38" height="48" rx="2" fill="currentColor" opacity=".06" />
        <rect x="206" y="152" width="48" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="258" y="158" width="36" height="50" rx="2" fill="currentColor" opacity=".06" />
        <rect x="298" y="148" width="56" height="60" rx="2" fill="currentColor" opacity=".08" />
        <rect x="358" y="156" width="40" height="52" rx="2" fill="currentColor" opacity=".07" />
        <rect x="840" y="152" width="52" height="56" rx="2" fill="currentColor" opacity=".07" />
        <rect x="896" y="160" width="36" height="48" rx="2" fill="currentColor" opacity=".06" />
        <rect x="936" y="150" width="58" height="58" rx="2" fill="currentColor" opacity=".08" />
        <rect x="998" y="158" width="40" height="50" rx="2" fill="currentColor" opacity=".07" />
        <rect x="1042" y="152" width="52" height="56" rx="2" fill="currentColor" opacity=".08" />
        <rect x="1098" y="160" width="34" height="48" rx="2" fill="currentColor" opacity=".06" />
        <rect x="1136" y="150" width="56" height="58" rx="2" fill="currentColor" opacity=".08" />
      </svg>

      <div class="relative z-10 flex flex-col items-center justify-center h-full gap-1">
        <h1 class="text-3xl font-medium tracking-tight">Varasto</h1>
        <p class="text-xs text-muted-foreground tracking-widest uppercase">Inventaarionhallinta</p>
        <transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0 translate-y-1"
          leave-active-class="transition-all duration-150" leave-to-class="opacity-0 translate-y-1">
          <div v-if="qrError"
            class="mt-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[12px] font-medium flex items-center gap-2">
            {{ qrError }}
            <button class="ml-1 opacity-60 hover:opacity-100" @click="qrError = null">✕</button>
          </div>
        </transition>
        <div class="grid grid-cols-2 gap-2.5 mt-3">
          <button v-for="c in Hero" :key="c.title"
            class="group flex flex-col gap-1 p-7.5 bg-background border border-border rounded-xl text-left transition-all hover:border-foreground/25 hover:bg-muted/40 hover:-translate-y-px active:translate-y-0"
            @click="c.action ? c.action() : router.push(c.route)">
            <div class="flex items-center justify-between mb-1.5">
              <div
                class="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <component :is="c.icon" :size="14" />
              </div>
              <ArrowRight :size="13"
                class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
            </div>
            <span class="text-[13px] font-medium text-foreground">{{ c.title }}</span>
            <span class="text-[11px] text-muted-foreground leading-snug">{{ c.desc }}</span>
          </button>
          <!-- QR error toast -->
        </div>

      </div>
    </div>

    <!-- SEARCH -->
    <div class="max-w-2xl mx-auto w-full px-6 -mt-6 relative z-20">
      <div class="relative" @focusin="isFocused = true" @focusout="onFocusOut">
        <div class="relative flex items-center">
          <Search class="absolute left-3.5 text-muted-foreground pointer-events-none" :size="17" />
          <input v-model="query" type="text" placeholder="Hae tavaroita, varastoja, laatikoita…" autocomplete="off"
            class="w-full h-12 pl-10 pr-10 text-sm font-medium bg-background border border-input rounded-xl shadow-sm outline-none ring-offset-background transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            @input="onInput" />
          <svg v-if="isLoading" class="absolute right-3.5 animate-spin text-muted-foreground" viewBox="0 0 24 24"
            fill="none" width="16" height="16">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32"
              stroke-dashoffset="12" stroke-linecap="round" />
          </svg>
        </div>

        <div v-if="isFocused && hasResults"
          class="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div
            class="px-3.5 py-2 text-[11px] font-medium text-muted-foreground tracking-widest uppercase border-b border-border bg-muted/40">
            {{ results.total }} tulosta
          </div>
          <ul class="max-h-96 overflow-y-auto">
            <template v-for="s in SECTIONS" :key="s.key">
              <template v-if="sectionData(s.key).length">
                <li
                  class="flex items-center justify-between px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground tracking-widest uppercase border-b border-border bg-muted/30 sticky top-0">
                  <span>{{ s.label }}</span>
                  <span v-if="sectionTotal(s.key) > sectionData(s.key).length"
                    class="normal-case tracking-normal font-normal">
                    {{ sectionData(s.key).length }} / {{ sectionTotal(s.key) }}
                  </span>
                </li>
                <li v-for="row in sectionData(s.key)" :key="row.id"
                  @mousedown.prevent="s.key === 'items' && router.push(`/items/${row.id}`)"
                  class="flex items-start justify-between px-3.5 py-2.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-0 transition-colors gap-4">
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="font-medium truncate">{{ row.name ?? row.number }}</span>
                    <span v-if="row.note" class="text-xs text-muted-foreground truncate">{{ row.note }}</span>
                    <span v-if="s.key === 'items' && itemBreadcrumb(row)" class="text-xs text-muted-foreground">{{
                      itemBreadcrumb(row) }}</span>
                    <span v-if="s.key === 'cabinets' && row.warehouse" class="text-xs text-muted-foreground">{{
                      row.warehouse.name }}</span>
                    <span v-if="s.key === 'shelves' && row.cabinet" class="text-xs text-muted-foreground">{{
                      row.cabinet.warehouse?.name }} › {{ row.cabinet.number }}</span>
                  </div>
                  <div class="flex flex-col items-end gap-0.5 shrink-0">
                    <span v-if="row.tag"
                      class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{{ row.tag
                      }}</span>
                    <span v-if="row.productGroup?.name" class="text-xs text-muted-foreground">{{ row.productGroup.name
                    }}</span>
                  </div>
                </li>
              </template>
            </template>
          </ul>
        </div>

        <div v-else-if="isFocused && noResults"
          class="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-md px-4 py-3 text-sm text-muted-foreground">
          Ei tuloksia haulle "{{ query }}"
        </div>
      </div>
    </div>

    <!-- CARDS -->
    <div class="max-w-2xl mx-auto w-full px-6 pt-8 pb-4 flex-1">

      <template v-if="!isAdmin">
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Pikaohjeet</p>
        <div class="grid grid-cols-3 gap-2.5 mb-8">
          <button v-for="c in userCards" :key="c.title"
            class="group flex flex-col gap-1 p-3.5 bg-background border border-border rounded-xl text-left transition-all hover:border-foreground/25 hover:bg-muted/40 hover:-translate-y-px active:translate-y-0"
            @click="router.push(c.route)">
            <div class="flex items-center justify-between mb-1.5">
              <div
                class="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <component :is="c.icon" :size="14" />
              </div>
              <ArrowRight :size="13"
                class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
            </div>
            <span class="text-[13px] font-medium text-foreground">{{ c.title }}</span>
            <span class="text-[11px] text-muted-foreground leading-snug">{{ c.desc }}</span>
          </button>
        </div>
      </template>

      <template v-else>
        <div class="flex items-center justify-between mb-3">
          <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Pikaohjeet</p>
          <span
            class="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-foreground text-background">
            <ShieldCheck :size="11" /> Admin
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2.5 mb-5">
          <button v-for="c in adminCards" :key="c.title"
            class="group flex flex-col gap-1 p-3.5 bg-background border border-border rounded-xl text-left transition-all hover:border-foreground/25 hover:bg-muted/40 hover:-translate-y-px active:translate-y-0"
            @click="router.push(c.route)">
            <div class="flex items-center justify-between mb-1.5">
              <div
                class="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <component :is="c.icon" :size="14" />
              </div>
              <ArrowRight :size="13"
                class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
            </div>
            <span class="text-[13px] font-medium text-foreground">{{ c.title }}</span>
            <span class="text-[11px] text-muted-foreground leading-snug">{{ c.desc }}</span>
          </button>
        </div>

        <div class="border-t border-border mb-5" />
        <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Tuo / vie</p>
        <div class="grid grid-cols-2 gap-2.5 mb-8">
          <button v-for="c in importExportCards" :key="c.title"
            class="group flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl text-left transition-all hover:border-foreground/25 hover:bg-muted/40 hover:-translate-y-px active:translate-y-0"
            @click="router.push(c.route)">
            <div
              class="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground flex-shrink-0">
              <component :is="c.icon" :size="17" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-foreground">{{ c.title }}</p>
              <p class="text-[11px] text-muted-foreground">{{ c.desc }}</p>
            </div>
            <ArrowRight :size="13"
              class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </div>
      </template>

      <div class="border-t border-border mb-5" />
      <p class="text-[11px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Sijainti</p>
      <WarehouseMap class="h-64 md:h-96" />
    </div>
  </div>
</template>