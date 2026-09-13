import type { FriendlyParticipant, FriendlyTeam } from '../types/friendly.types'

export const unpairedFriendlyParticipants = (participants: FriendlyParticipant[], teams: FriendlyTeam[]) => {
  const pairedIds = new Set(teams.flatMap(team => (team.members ?? []).map(member => member.id)))
  return participants.filter(participant => !pairedIds.has(participant.player_id))
}

export const canShowTeamSetup = (eventType: string, isCreator: boolean) => eventType === 'DOUBLES' && isCreator
export const canCreateManualPair = (ids: string[]) => ids.length === 2 && ids[0] !== ids[1] && ids.every(Boolean)
export const shuffleDisabledReason = (count: number) => count === 0 ? 'At least two unpaired players are required.' : count % 2 ? 'An even number of unpaired players is required.' : count < 2 ? 'At least two unpaired players are required.' : null
export const pairingLockedMessage = 'Pairing is locked because fixtures have already been generated.'
