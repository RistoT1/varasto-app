import client from './client.js'

export async function getShelves({ kaappi_id, varasto_id } = {}) {
  const params = {}
  if (kaappi_id) params.kaappi_id = kaappi_id
  if (varasto_id) params.varasto_id = varasto_id
  const { data } = await client.get('/shelves', { params })
  return data // array of { id, number, itemCount, cabinet: { id, number, warehouse } }
}

export async function getShelf(id) {
  const { data } = await client.get(`/shelves/${id}`)
  return data // { id, number, cabinet: { id, number, warehouse: { id, name } } }
}

export async function getShelfItems(id, { page = 1, limit = 50 } = {}) {
  const { data } = await client.get(`/shelves/${id}/items`, { params: { page, limit } })
  return data // { data: [...], pagination: {...} }
}

export async function createShelf({ number, kaappi_id }) {
  const { data } = await client.post('/shelves', { number, kaappi_id })
  return data
}

export async function updateShelf(id, { number, kaappi_id }) {
  const { data } = await client.put(`/shelves/${id}`, { number, kaappi_id })
  return data
}

export async function deleteShelf(id) {
  await client.delete(`/shelves/${id}`)
}