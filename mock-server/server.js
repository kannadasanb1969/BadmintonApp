import cors from 'cors'
import express from 'express'
import { create, findById, patch, readCollection, remove, replace } from './utils/jsonFileRepository.js'

const app = express()
const port = 3001
const collections = ['users', 'players', 'guest-players', 'tournaments', 'registrations', 'teams', 'fixtures', 'matches', 'results', 'medals', 'notifications']
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'Badminton Mock API' }))

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const { mobile, role } = request.body ?? {}
    const user = (await readCollection('users')).find(item => item.mobile === mobile && item.role === role)
    if (!user) return response.status(404).json({ message: 'User not found' })
    return response.json(user)
  } catch (error) { return next(error) }
})

collections.forEach((collection) => {
  const base = `/api/${collection}`
  app.get(base, async (request, response, next) => { try { let items = await readCollection(collection); for (const [key, value] of Object.entries(request.query)) items = items.filter(item => String(item[key]) === String(value)); response.json(items) } catch (error) { next(error) } })
  app.get(`${base}/:id`, async (request, response, next) => { try { const item = await findById(collection, request.params.id); if (!item) return response.status(404).json({ message: `${collection} record not found` }); return response.json(item) } catch (error) { return next(error) } })
  app.post(base, async (request, response, next) => { try { if (!request.body?.id) return response.status(400).json({ message: 'id is required' }); return response.status(201).json(await create(collection, request.body)) } catch (error) { return next(error) } })
  app.put(`${base}/:id`, async (request, response, next) => { try { const item = await replace(collection, request.params.id, { ...request.body, id: request.params.id }); if (!item) return response.status(404).json({ message: `${collection} record not found` }); return response.json(item) } catch (error) { return next(error) } })
  app.patch(`${base}/:id`, async (request, response, next) => { try { const item = await patch(collection, request.params.id, request.body ?? {}); if (!item) return response.status(404).json({ message: `${collection} record not found` }); return response.json(item) } catch (error) { return next(error) } })
  app.delete(`${base}/:id`, async (request, response, next) => { try { if (!await remove(collection, request.params.id)) return response.status(404).json({ message: `${collection} record not found` }); return response.status(200).json({ id: request.params.id }) } catch (error) { return next(error) } })
})
app.use((error, _request, response, _next) => { console.error(error); response.status(500).json({ message: 'Failed to access mock data' }) })
app.listen(port, () => console.log(`Badminton Mock API listening on http://localhost:${port}/api`))
