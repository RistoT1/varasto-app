<script setup lang="ts">
import AppSidebar from '@/components/includes/navbar.vue'
import Footer from './components/includes/footer.vue'
import { useAuthStore } from './stores/auth'
import { useQrCodePanelStore } from '@/stores/useQrCodePanelStore'
import FromQRCode from '@/views/overlay/FromQRCode.vue' 

const authStore = useAuthStore()
const qrStore = useQrCodePanelStore()  // reactive store for modal
</script>

<template>
  <router-view v-if="!authStore.isAuthenticated" />

  <div v-else class="min-h-screen relative">
    <AppSidebar />
    <main class="md:ml-12">  
      <router-view />
    </main>
    <Footer />

    <!-- QR modal overlay -->
    <FromQRCode v-if="qrStore.open" />
  </div>
</template>

