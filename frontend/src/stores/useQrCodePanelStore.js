import { defineStore } from 'pinia'

export const useQrCodePanelStore = defineStore('qrCodePanel', {
    state: () => ({
        open: false,
    }),
    actions: {
        toggle() {
            this.open = !this.open
        },
        openPanel() {
            this.open = true
        },
        closePanel() {
            this.open = false
        },
    },
})