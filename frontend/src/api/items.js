import client from './client.js'

export async function searchItems({ query = '', page = 1, limit = 50, signal } = {}) {
  const response = await client.get('/items/search', {
    params: { q: query, page, limit },
    signal
  })
  return response.data
}

export async function getItems({ page = 1, limit = 50, signal } = {}) {
  const response = await client.get('/items', {
    params: { page, limit },
    signal
  })
  return response.data
}


export async function getItem(id) {
  const response = await client.get(`/items/${id}`)
  return response.data
}

export async function createItem(payload) {
  const response = await client.post('/items', payload)
  return response.data
}

export async function replaceItem(id, payload) {
  const response = await client.put(`/items/${id}`, payload)
  return response.data
}

export async function updateItem(id, payload) {
  const response = await client.patch(`/items/${id}`, payload)
  return response.data
}

export async function deleteItem(id) {
  const response = await client.delete(`/items/${id}`)
  return response.data
}