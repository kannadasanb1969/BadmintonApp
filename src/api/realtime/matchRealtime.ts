import { apiBaseUrl } from '@/api/apiClient'
import { MatchStatus } from '@/features/fixtures/types/fixture.types'

export type MatchRealtimeEventType = 'MATCH_STARTED' | 'MATCH_SCORE_UPDATED' | 'MATCH_COMPLETED'

export interface MatchRealtimeEvent {
  type: MatchRealtimeEventType
  matchId: string
  status: MatchStatus
  participant1Score: number
  participant2Score: number
  winningPoints?: 15 | 21 | 30
  winnerParticipantId?: string | null
  winnerParticipantName?: string | null
  winnerParticipantCode?: string | null
  updatedAt?: string
}

export type MatchRealtimeState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'

type Listener = {
  onEvent: (event: MatchRealtimeEvent) => void
  onStateChange?: (state: MatchRealtimeState) => void
  onReconnect?: () => void
}

const eventTypes = new Set<MatchRealtimeEventType>(['MATCH_STARTED', 'MATCH_SCORE_UPDATED', 'MATCH_COMPLETED'])

export const buildMatchRealtimeUrl = (matchId: string, accessToken: string): string => {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/api/realtime/matches/${encodeURIComponent(matchId)}`
  url.search = ''
  url.searchParams.set('token', accessToken)
  return url.toString()
}

const parseEvent = (raw: string, expectedMatchId: string): MatchRealtimeEvent | null => {
  try {
    const value = JSON.parse(raw) as Partial<MatchRealtimeEvent>
    if (!value.type || !eventTypes.has(value.type) || value.matchId !== expectedMatchId) return null
    if (typeof value.participant1Score !== 'number' || typeof value.participant2Score !== 'number') return null
    return value as MatchRealtimeEvent
  } catch {
    return null
  }
}

class SharedMatchConnection {
  private socket: WebSocket | null = null
  private retryTimer: number | null = null
  private retryCount = 0
  private stopped = false
  private hasConnected = false
  readonly listeners = new Set<Listener>()

  constructor(private readonly matchId: string, private readonly accessToken: string) {}

  start() {
    if (this.socket || this.stopped) return
    this.connect()
  }

  private notifyState(state: MatchRealtimeState) {
    this.listeners.forEach(listener => listener.onStateChange?.(state))
  }

  private connect() {
    if (this.stopped || this.listeners.size === 0) return
    this.notifyState(this.retryCount > 0 ? 'RECONNECTING' : 'CONNECTING')
    const socket = new WebSocket(buildMatchRealtimeUrl(this.matchId, this.accessToken))
    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) return
      const reconnected = this.hasConnected
      this.hasConnected = true
      this.retryCount = 0
      this.notifyState('CONNECTED')
      if (reconnected) this.listeners.forEach(listener => listener.onReconnect?.())
    }
    socket.onmessage = ({ data }) => {
      if (typeof data !== 'string') return
      const event = parseEvent(data, this.matchId)
      if (event) this.listeners.forEach(listener => listener.onEvent(event))
    }
    socket.onerror = () => socket.close()
    socket.onclose = ({ code }) => {
      if (this.socket === socket) this.socket = null
      if (this.stopped || this.listeners.size === 0) return
      this.notifyState('DISCONNECTED')
      // Authentication/policy failures need a new session, not an endless retry loop.
      if (code === 1008 || code === 4001 || code === 4003) return
      const delay = Math.min(1000 * 2 ** this.retryCount, 8000)
      this.retryCount += 1
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null
        this.connect()
      }, delay)
    }
  }

  stop() {
    this.stopped = true
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.socket?.close(1000, 'Subscription ended')
    this.socket = null
    this.notifyState('DISCONNECTED')
  }
}

const connections = new Map<string, SharedMatchConnection>()

export const subscribeToMatchRealtime = (matchId: string, accessToken: string, listener: Listener) => {
  const key = `${matchId}:${accessToken}`
  let connection = connections.get(key)
  if (!connection) {
    connection = new SharedMatchConnection(matchId, accessToken)
    connections.set(key, connection)
  }
  connection.listeners.add(listener)
  connection.start()

  return () => {
    connection!.listeners.delete(listener)
    if (connection!.listeners.size === 0) {
      connection!.stop()
      connections.delete(key)
    }
  }
}
