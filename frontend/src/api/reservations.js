import client from './client.js'


export async function getItemReservations(itemId, { active, page = 1, limit = 10 } = {}) {
  const params = { item_id: itemId, page, limit }
  if (active !== undefined) {
    if (active !== true && active !== false) throw new Error('active must be a boolean')
    params.active = active
  }
  const { data } = await client.get('/reservations', { params })
  return data
}

export async function getReservations({ page = 1, limit = 50, active, user_id } = {}) {
  const params = { page, limit }
  if (active !== undefined) params.active = active
  if (user_id !== undefined) params.user_id = user_id
  const { data } = await client.get('/reservations', {
    params,
    headers: { 'Cache-Control': 'no-cache' }
  })
  return data
}

export async function createReservation(itemId, options = {}) {
  const payload = { item_id: itemId }
  if (options.userId) payload.user_id = options.userId
  if (options.alku) payload.Varaus_alku = new Date(options.alku).toISOString().split('.')[0] + 'Z'
  if (options.loppu) payload.Varaus_loppu = new Date(options.loppu).toISOString().split('.')[0] + 'Z'

  const { data } = await client.post('/reservations', payload)
  return data
}

// PATCH /reservations/:id/return
export async function closeReservation(id) {
  const { data } = await client.patch(`/reservations/${id}/return`)
  return data
}

// DELETE /reservations/:id
export async function deleteReservation(id) {
  await client.delete(`/reservations/${id}`)
}