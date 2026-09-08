import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { PlayerProfile } from '@/features/player/types/player.types'
import { TournamentFormValues } from '@/features/tournaments/types/tournament.types'
import fixtureDemoData from '../../../../mock-api/tournaments/doubles-fixture-demo.json'

export const createDoublesFixtureDemo = async (organizer: { id: string; mobile: string; displayName?: string; role: string }) => {
  const tournamentStore = useTournamentStore.getState()
  const tournament = tournamentStore.createTournament({
    ...fixtureDemoData.tournament,
    organizerMobile: organizer.mobile,
  } as TournamentFormValues, organizer)

  tournamentStore.submitTournamentForApproval(tournament.id)
  tournamentStore.approveTournament(tournament.id, organizer.id)
  const published = tournamentStore.publishTournament(tournament.id)
  const category = published.categories[0]
  const now = new Date().toISOString()
  const players: PlayerProfile[] = fixtureDemoData.players.map((player) => ({
    ...fixtureDemoData.playerDefaults,
    ...player,
    profileStatus: fixtureDemoData.playerDefaults.profileStatus as PlayerProfile['profileStatus'],
    createdAt: now,
    updatedAt: now,
  }))
  const directory = usePlayerDirectoryStore.getState()
  players.forEach(player => directory.upsertProfile(player))

  const teams = useTeamStore.getState()
  const registrations = useRegistrationStore.getState()
  for (let index = 0; index < players.length; index += 2) {
    const player1 = players[index]
    const player2 = players[index + 1]
    const team = teams.createTeam({ tournamentId: published.id, tournamentCode: published.tournamentCode, categoryId: category.id, categoryName: category.name, player1Id: player1.id, player1Code: player1.playerCode, player1Name: player1.fullName, player1Type: 'FULL', player2Id: player2.id, player2Code: player2.playerCode, player2Name: player2.fullName, player2Type: 'FULL', partnerStatus: 'PENDING_CONFIRMATION', status: 'PENDING_PARTNER' })
    teams.acceptPartner(team.id)
    const confirmed = teams.confirmTeam(team.id)!
    registrations.createRegistration({ tournamentId: published.id, tournamentCode: published.tournamentCode, categoryId: category.id, categoryName: category.name, playerId: player1.id, playerCode: player1.playerCode, playerName: player1.fullName, eventType: 'DOUBLES', status: 'REGISTERED', registeredAt: now, teamId: confirmed.id, teamCode: confirmed.teamCode, partnerId: player2.id, partnerCode: player2.playerCode, partnerName: player2.fullName, partnerType: 'FULL' })
  }
  await useTournamentStore.getState().closeCategoryRegistration(organizer.id, published.id, category.id)
  return published.id
}
