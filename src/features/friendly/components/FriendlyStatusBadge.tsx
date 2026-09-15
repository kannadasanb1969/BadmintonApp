import type { FriendlyMatchStatus } from '@/features/friendly/types/friendly.types'

const colors: Record<FriendlyMatchStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', OPEN: 'bg-emerald-100 text-emerald-800', ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-violet-100 text-violet-800', CLEANUP_PENDING: 'bg-amber-100 text-amber-800', DELETED: 'bg-rose-100 text-rose-700',
}

export const FriendlyStatusBadge = ({ status }: { status: FriendlyMatchStatus }) => <span className={`rounded-full px-3 py-1 text-xs font-extrabold tracking-wide ${colors[status]}`}>{status.replace('_', ' ')}</span>
