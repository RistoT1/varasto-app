import client from './client.js'

export async function getProductGroups({ search } = {}) {
  const params = {}
  if (search) params.search = search
  const { data } = await client.get('/product-groups', { params })
  return data
}

export async function getProductGroup(id) {
  const { data } = await client.get(`/product-groups/${id}`)
  return data
}

export async function getProductGroupItems(id, { page = 1, limit = 50 } = {}) {
  const { data } = await client.get(`/product-groups/${id}/items`, { params: { page, limit } })
  return data
}

export async function createProductGroup(payload) {
  const { data } = await client.post('/product-groups', payload)
  return data
}

export async function updateProductGroup(id, payload) {
  const { data } = await client.put(`/product-groups/${id}`, payload)
  return data
}

export async function deleteProductGroup(id) {
  await client.delete(`/product-groups/${id}`)
}
