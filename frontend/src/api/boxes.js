import client from './client.js'

export async function getBoxes({ search } = {}) {
  const params = {}
  if (search) params.search = search
  const { data } = await client.get('/boxes', { params })
  return data
}

export async function getBox(id) {
  const { data } = await client.get(`/boxes/${id}`)
  return data
}

export async function getBoxItems(id) {
  const { data } = await client.get(`/boxes/${id}/items`)
  return data
}

export async function createBox(payload) {
  const { data } = await client.post('/boxes', payload)
  return data
}

export async function updateBox(id, payload) {
  const { data } = await client.put(`/boxes/${id}`, payload)
  return data
}

export async function deleteBox(id) {
  await client.delete(`/boxes/${id}`)
}