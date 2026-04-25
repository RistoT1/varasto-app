//Tekoälyn tuottama
import { defineStore } from 'pinia'
import { watch } from 'vue'
import { me } from '../api/auth'

let authPromise = null
let tarkistusIntervaali = null
let subscribeRekisteroity = false
const TARKISTUS_INTERVALLI = 15 * 60 * 1000

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    ready: false
  }),

  getters: {
    isAdmin: (state) => state.user?.kayttolupa === 'Admin'
  },

  actions: {
    async checkAuth() {
      if (authPromise) return authPromise

      authPromise = (async () => {
        try {
          const { data } = await me()
          this.$patch({ isAuthenticated: true, user: Object.freeze({ ...data.user }), ready: true })
          this._kaynnistaTarkistus()
          this._kuunteleManipulaatio()
        } catch {
          this.$patch({ isAuthenticated: false, user: null, ready: true })
        }
      })()

      return authPromise
    },

    async _paivitaKayttaja() {
      try {
        const { data } = await me()
        this.$patch({ user: Object.freeze({ ...data.user }), isAuthenticated: true })
        if (data.user?.kayttolupa !== 'Admin') this._pysaytaTarkistus()
      } catch {
        this.logout()
      }
    },

    _kaynnistaTarkistus() {
      if (tarkistusIntervaali) return
      if (!this.isAdmin) return
      tarkistusIntervaali = setInterval(() => this._paivitaKayttaja(), TARKISTUS_INTERVALLI)
    },

    _pysaytaTarkistus() {
      clearInterval(tarkistusIntervaali)
      tarkistusIntervaali = null
    },

    _kuunteleManipulaatio() {
      if (subscribeRekisteroity) return
      subscribeRekisteroity = true

      let vahvistettuId   = this.user?.id
      let vahvistettuLupa = this.user?.kayttolupa

      // watch catches external state mutations that $subscribe might miss
      // e.g. pinia.state.value.auth.user = { ...user, kayttolupa: 'Admin' }
      watch(
        () => [this.user?.id, this.user?.kayttolupa],
        async ([newId, newLupa]) => {
          if (!this.isAuthenticated || !this.user) return
          if (newId === vahvistettuId && newLupa === vahvistettuLupa) return

          try {
            const { data } = await me()
            vahvistettuId   = data.user?.id
            vahvistettuLupa = data.user?.kayttolupa

            // patch back the real server values
            this.$patch({ user: Object.freeze({ ...data.user }), isAuthenticated: true })

            // if what was set doesn't match server → reload
            if (newId !== vahvistettuId || newLupa !== vahvistettuLupa) {
              window.location.reload()
            }
          } catch {
            this.logout()
            window.location.reload()
          }
        }
      )

      // $subscribe as backup for internal Pinia mutations
      this.$subscribe(async () => {
        if (!this.isAuthenticated || !this.user) return
        if (this.user.id === vahvistettuId && this.user.kayttolupa === vahvistettuLupa) return

        try {
          const { data } = await me()
          vahvistettuId   = data.user?.id
          vahvistettuLupa = data.user?.kayttolupa

          this.$patch({ user: Object.freeze({ ...data.user }), isAuthenticated: true })

          if (this.user?.id !== vahvistettuId || this.user?.kayttolupa !== vahvistettuLupa) {
            window.location.reload()
          }
        } catch {
          this.logout()
          window.location.reload()
        }
      })
    },

    setAuthenticated(user) {
      this.$patch({ isAuthenticated: true, user: Object.freeze({ ...user }) })
      this._kaynnistaTarkistus()
      this._kuunteleManipulaatio()
    },

    logout() {
      this._pysaytaTarkistus()
      subscribeRekisteroity = false
      authPromise = null
      this.$patch({ isAuthenticated: false, user: null, ready: false })
    }
  }
})