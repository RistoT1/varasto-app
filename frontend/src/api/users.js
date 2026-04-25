import client from './client.js'

// GET /api/users (admin only)
export async function getUsers() {
  const { data } = await client.get('/users')
  return data
}

// GET /api/users/:id (admin or self)
export async function getUser(id) {
  const { data } = await client.get(`/users/${id}`)
  return data
}

// POST /api/users (admin)
export async function createUser(payload) {
  const { data } = await client.post('/users', payload)
  return data
}

// PATCH /api/users/:id/password (self or admin)
export async function changePassword(id, password) {
  const { data } = await client.patch(`/users/${id}/password`, { password })
  return data
}

// PATCH /api/users/:id/status (admin)
export async function setUserStatus(id, active) {
  const { data } = await client.patch(`/users/${id}/status`, { active })
  return data
}

// DELETE /api/users/:id (admin)
export async function deleteUser(id) {
  await client.delete(`/users/${id}`)
}