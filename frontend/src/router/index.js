import { createRouter, createWebHistory } from 'vue-router'
import { me } from '../api/auth.js'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Reservations from '../views/Reservations.vue'



async function requireAdmin() {
  try {
    const { data } = await me()
    if (data.user?.kayttolupa !== 'Admin') return { name: 'Home' }
  } catch {
    return { name: 'Home' }
  }
}

async function requireAdminOrSelf(to) {
  try {
    const { data } = await me()
    const isAdmin = data.user?.kayttolupa === 'Admin'
    const isSelf = data.user?.id === Number(to.params.id)
    if (!isAdmin && !isSelf) return { name: 'Home' }
  } catch {
    return { name: 'Home' }
  }
}

const routes = [
  { path: '/login', name: 'Login', component: Login, meta: { public: true } },
  { path: '/', name: 'Home', component: Home },
  { path: '/items', name: 'Items', component: () => import('../views/Items.vue') },
  { path: '/items/:id', name: 'ItemView', component: () => import('../views/Itemview.vue') },
  { path: '/warehouses', name: 'Warehouses', component: () => import('../views/Warehouses.vue') },
  { path: '/warehouses/:id', name: 'WarehousesView', component: () => import('../views/WarehouseView.vue') },
  { path: '/cabinets/:id', name: 'CabinetView', component: () => import('../views/CabinetView.vue') },
  { path: '/shelves/:id', name: 'ShelfView', component: () => import('../views/ShelfView.vue') },
  { path: '/reservations', name: 'Reservations', component: Reservations },
  { path: '/profile', name: 'Profile', component: () => import('../views/Profile.vue') },
  { path: '/map', name: 'MapEditor', component: () => import('../views/MapEditor.vue'), beforeEnter: requireAdmin },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue'), beforeEnter: requireAdmin },
  { path: '/users/:id', name: 'UserProfile', component: () => import('../views/Profile.vue'), beforeEnter: requireAdminOrSelf },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { useAuthStore } = await import('../stores/auth')
  const { useQrCodePanelStore } = await import('@/stores/useQrCodePanelStore')
  const authStore = useAuthStore()
  const qrStore = useQrCodePanelStore()

  if (!authStore.ready) {
    await authStore.checkAuth()
  }

  if (to.query.FQR === '1') {
    qrStore.open = true
  } else {
    qrStore.open = false 
  }


  const isPublic = to.meta.public === true

  if (!isPublic && !authStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  if (isPublic && authStore.isAuthenticated && to.name === 'Login') {
    return { name: 'Home' }
  }

  return true
})

export default router