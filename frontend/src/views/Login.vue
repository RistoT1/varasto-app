<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Täytä kentät'
    return
  }

  try {
    const { data } = await login(username.value, password.value)

    // Token on nyt cookiessa — tallennetaan vain käyttäjätieto storeen
    authStore.setAuthenticated(data.user)

    const redirectTo = route.query.redirect || '/'
    router.push({
      path: redirectTo,
      query: route.query
    })

  } catch (err) {
    if (err.response?.status === 401) {
      error.value = 'Virheellinen käyttäjänimi tai salasana'
      return
    }
    error.value = err.response?.data?.error || err.message || 'Kirjautuminen epäonnistui'
  }
}
</script>

<template>
  <div class="login-container container">
    <form class="login" @submit.prevent="handleLogin">
      <h2>Login</h2>
      <input v-model="username" required type="text" placeholder="Username" />
      <input v-model="password" required type="password" placeholder="Password" />
      <button type="submit">Sign in</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
    <div class="info-container">
      <img src="https://www.epressi.com/media/mediabankfiles/1524/savon_ammattiopisto_logo.png" alt="">
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: calc(100dvh - 26px);
  overflow-y: hidden;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
}

.login {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  max-width: 320px;
  gap: 1rem;
  transform: translateY(-100px);
}

.info-container {
  height: 100%;
  max-height: 30vh;
  width: 100%;
  background-color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
}

.info-container img {
  height: 100%;
  max-height: 10vh;
  margin-right: 50px;
}

input {
  padding: 0.5rem;
  border: 1px solid #000000;
  background-color: white;
  border-radius: 8px;
  color: black
}

button {
  padding: 0.5rem;
  background: #fdbc00;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error {
  color: red;
}
</style>