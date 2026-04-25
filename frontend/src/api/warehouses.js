import client from './client.js'

export async function getWarehouses() {
  const { data } = await client.get('/warehouses')
  return data 
}

export async function getWarehouse(id) {
  const { data } = await client.get(`/warehouses/${id}`)
  return data
}

export async function getWarehouseCabinets(id) {
  const { data } = await client.get(`/warehouses/${id}/cabinets`)
  return data // array of { id, number, shelfCount }
}

export async function getWarehouseItems(id, { page = 1, limit = 50 } = {}) {
  const { data } = await client.get(`/warehouses/${id}/items`, { params: { page, limit } })
  return data // { data: [...], pagination: {...} }
}

export async function createWarehouse(name) {
  const { data } = await client.post('/warehouses', { name })
  return data
}

export async function updateWarehouse(id, name) {
  const { data } = await client.put(`/warehouses/${id}`, { name })
  return data
}

export async function deleteWarehouse(id) {
  await client.delete(`/warehouses/${id}`)
}