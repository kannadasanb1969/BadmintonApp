import apiClient, { isExplicitMockApiMode, webApiBaseUrl, webApiPath } from '@/api/apiClient'

export const webTournamentEnabled = Boolean(webApiBaseUrl) && !isExplicitMockApiMode && import.meta.env.VITE_WEB_TOURNAMENTS === '1'
const config = { baseURL: webApiBaseUrl }
export const webCategoryPath = (tournamentId: string, categoryId: string) =>
  `${webApiPath}/tournaments/${encodeURIComponent(tournamentId)}/categories/${encodeURIComponent(categoryId)}`

export const webTournamentApi = {
  async saveMinimum(tournamentId: string, categoryId: string, minTeams: number) {
    await apiClient.patch(webCategoryPath(tournamentId, categoryId) + '/minimum-teams', { minTeams }, config)
  },
  async removeCategory(tournamentId: string, categoryId: string) {
    await apiClient.delete(webCategoryPath(tournamentId, categoryId), config)
  },
}
