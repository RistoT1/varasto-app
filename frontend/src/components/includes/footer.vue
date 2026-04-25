<script setup>
const sakkyLogo = '/images/Savon_koulutuskuntayhtyma_logo-600x110.png'
</script>
<template>
    <footer class="relative overflow-hidden mt-10 shrink-0">
        <!-- wave SVG -->
        <svg class="w-full block text-muted" viewBox="0 0 1200 72" preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0,36 C200,72 400,0 600,36 C800,72 1000,0 1200,36 L1200,72 L0,72 Z" fill="currentColor"
                opacity=".35" />
            <path d="M0,50 C150,18 350,68 600,50 C850,32 1050,64 1200,50 L1200,72 L0,72 Z" fill="currentColor"
                opacity=".55" />
            <path d="M0,60 C250,42 500,72 750,60 C900,52 1100,68 1200,60 L1200,72 L0,72 Z" fill="currentColor" />
        </svg>
        <div class="bg-muted px-6 pb-5 pt-0">
            <div class="max-w-2xl mx-auto flex items-center justify-between">
                <p class="text-[11px] text-muted-foreground">Varasto — inventaarionhallinta</p>
                <img :src="sakkyLogo" alt="sakky logo"
                    class="h-8 w-auto object-contain hover:opacity-100 opacity-70 transition" />
            </div>
        </div>
    </footer>
</template>