import type { Fixture } from '@/features/fixtures/types/fixture.types'

export const fixtureForTournamentCategory = (fixtures: Fixture[], tournamentId: string, categoryId: string) => fixtures.find(fixture => fixture.tournamentId === tournamentId && fixture.categoryId === categoryId)

export const playerFixtureUrl = (fixture: Fixture) => `/player/fixtures?${new URLSearchParams({ fixtureId: fixture.id, tournamentId: fixture.tournamentId, categoryId: fixture.categoryId })}`
