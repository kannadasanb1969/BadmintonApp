import type { CreateFriendlyMatchRequest } from '@/features/friendly/types/friendly.types'

export const validateFriendlyMatch = (value: CreateFriendlyMatchRequest): string | null => {
  if (!value.title.trim()) return 'Title is required.'
  if (!Number.isInteger(value.maxPlayers)) return 'Max players must be a whole number.'
  if (value.eventType === 'SINGLES' && (value.maxPlayers < 6 || value.maxPlayers > 16)) return 'Singles requires 6 to 16 players.'
  if (value.eventType === 'DOUBLES' && (value.maxPlayers < 8 || value.maxPlayers > 16)) return 'Doubles requires 8 to 16 players.'
  if (value.eventType === 'DOUBLES' && value.maxPlayers % 2 !== 0) return 'Doubles requires an even number of players.'
  return null
}

export const friendlyDetailsPath = (id: string) => `/player/friendly-matches/${id}`
