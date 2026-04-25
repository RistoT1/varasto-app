//Tekoälyn tuottama
import client from './client.js'

// ─── List ─────────────────────────────────────────────────────────
// Options: { varasto_id, search, mapped }
export async function getCabinets({ varasto_id, search, mapped } = {}) {
  const params = {}
  if (varasto_id !== undefined) params.varasto_id = varasto_id
  if (search      !== undefined) params.search     = search
  if (mapped      !== undefined) params.mapped      = mapped
  const { data } = await client.get('/cabinets', { params })
  return data // { status, count, data: [{ id, number, varasto_id, map_x, map_y, color, varasto_nimi, shelfCount }] }
}

// ─── Single ───────────────────────────────────────────────────────
export async function getCabinet(id) {
  const { data } = await client.get(`/cabinets/${id}`)
  return data // { id, number, varasto_id, map_x, map_y, color, varasto_nimi }
}

// ─── Shelves ──────────────────────────────────────────────────────
export async function getCabinetShelves(id) {
  const { data } = await client.get(`/cabinets/${id}/shelves`)
  return data // { status, count, data: [{ id, number, kaappi_id, itemCount }] }
}

// ─── Create ───────────────────────────────────────────────────────
export async function createCabinet({ number, varasto_id, map_x = null, map_y = null, color = '#2563eb' }) {
  const { data } = await client.post('/cabinets', { number, varasto_id, map_x, map_y, color })
  return data
}

// ─── Update ───────────────────────────────────────────────────────
export async function updateCabinet(id, { number, varasto_id, map_x = null, map_y = null, color = '#2563eb' }) {
  const { data } = await client.put(`/cabinets/${id}`, { number, varasto_id, map_x, map_y, color })
  return data
}

// ─── Update map position + väri (drag-end ja värinvaihto) ────────
// map_x/map_y null → poistetaan kartalta
// color on valinnainen — jos puuttuu, backend ei muuta väriä
export async function updateCabinetPosition(id, { map_x, map_y, color } = {}) {
  const body = {
    map_x: map_x !== null && map_x !== undefined ? Math.round(map_x) : null,
    map_y: map_y !== null && map_y !== undefined ? Math.round(map_y) : null,
  }
  //Lisätään color vain jos se on annettu
  if (color !== undefined) body.color = color

  const { data } = await client.patch(`/cabinets/${id}/position`, body)
  return data
}

// ─── Delete ───────────────────────────────────────────────────────
export async function deleteCabinet(id) {
  await client.delete(`/cabinets/${id}`)
}