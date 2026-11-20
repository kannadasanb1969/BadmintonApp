import { resourceId, WebApiError } from './java.mjs'

export function tournamentRoutes(router, enabled) {
  const categoryPath = '/tournaments/:tournamentId/categories/:categoryId'
  async function context(req) {
    if (!enabled) throw new WebApiError(503, 'Web tournament controls are unavailable on this server')
    if (req.webUser.role !== 'ORGANIZER') throw new WebApiError(403, 'An organizer account is required')
    const path = '/api/tournaments/' + resourceId(req.params.tournamentId)
    const categoryId = req.params.categoryId
    resourceId(categoryId)
    const tournament = await req.java(path)
    if (tournament?.organizerId !== req.webUser.id) throw new WebApiError(403, 'Only the tournament organizer can make this change')
    const category = tournament.categories?.find(item => item.id === categoryId)
    if (!category) throw new WebApiError(404, 'Category not found')
    return { path, categoryId, category, tournament }
  }

  router.patch(categoryPath + '/minimum-teams', async (req, res) => {
    const minTeams = req.body?.minTeams
    if (!Number.isInteger(minTeams) || minTeams < 2 || minTeams > 2147483647) {
      throw new WebApiError(400, 'Minimum teams must be a whole number of at least two')
    }
    const { path, categoryId, category } = await context(req)
    if (category.maxTeams != null && minTeams > category.maxTeams) {
      throw new WebApiError(400, 'Minimum teams cannot exceed category capacity')
    }
    const updated = await req.java(path, 'PUT', { categories: [{ id: categoryId, minTeams }] })
    const saved = updated?.categories?.find(item => item.id === categoryId)
    if (saved?.minTeams !== minTeams) throw new WebApiError(502, 'The tournament service did not persist minimum teams')
    res.json({ success: true, data: saved })
  })

  router.delete(categoryPath, async (req, res) => {
    const { path, categoryId } = await context(req)
    const updated = await req.java(path, 'PUT', { categories: [], removedCategoryIds: [categoryId] })
    if (!Array.isArray(updated?.categories) || updated.categories.some(item => item.id === categoryId)) {
      throw new WebApiError(502, 'The tournament service did not remove this category')
    }
    res.status(204).end()
  })

  router.post(categoryPath + '/fixtures', async (req, res) => {
    const { categoryId, tournament } = await context(req)
    const rawFormat = req.body?.format ?? tournament.fixtureFormat
    const format = rawFormat === 'LEAGUE_KNOCKOUT' ? 'LEAGUE' : rawFormat
    if (!['LEAGUE', 'KNOCKOUT'].includes(format)) throw new WebApiError(400, 'Select a fixture format')
    // Java checks minimum teams and creates fixtures in the same transaction.
    const fixture = await req.java('/api/fixtures/generate', 'POST', {
      tournamentId: req.params.tournamentId, categoryId, format, organizerUserId: req.webUser.id,
    })
    res.status(201).json({ success: true, data: fixture })
  })
}
