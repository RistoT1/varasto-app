import client from './client.js'

export async function searchAll({ query = '', limit = 20, signal } = {}) {
  const response = await client.get('/search', {
    params: { q: query, limit },
    signal
  })
  return response.data
}