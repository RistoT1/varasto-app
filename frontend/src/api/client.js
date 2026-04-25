import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config.url !== '/auth/login') {
      const { useAuthStore } = await import('../stores/auth')
      const authStore = useAuthStore()

      if (!authStore.ready) return Promise.reject(error)
      authStore.logout()

      const { default: router } = await import('../router')
      router.push({ name: 'Login' })
    }
    return Promise.reject(error)
  }
)

export default client