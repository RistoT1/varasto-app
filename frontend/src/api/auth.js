import client from './client'

export const login = (username, password) =>
  client.post('/auth/login', { username, password })

export const logout = () =>
  client.post('/auth/logout')  

export const me = () =>
  client.get('/auth/me')

export const register = (email, password) =>
  client.post('/auth/register', { email, password })