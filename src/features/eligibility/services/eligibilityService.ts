import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'

export type EligibilityRequest = { tournamentId: string; categoryId: string; playerId: string; partner?: { id: string; type: 'PLAYER' | 'GUEST' } }

export const eligibilityService = {
  check: async (request: EligibilityRequest): Promise<EligibilityResult> => {
    if (isExplicitMockApiMode) throw new Error('Worker eligibility check is unavailable in mock mode')
    return (await apiClient.post<EligibilityResult>('/api/eligibility/check', request)).data
  },
}
