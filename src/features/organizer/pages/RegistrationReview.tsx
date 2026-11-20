import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { registrationService } from '@/features/registrations/services/registrationService'

export function RegistrationReview({ tournamentId, categoryId }: { tournamentId: string; categoryId: string }) {
  const client = useQueryClient()
  const queryKey = ['organizer-registration-review', tournamentId, categoryId]
  const query = useQuery({ queryKey, queryFn: () => registrationService.getTournamentRegistrations(tournamentId), enabled: !isExplicitMockApiMode, retry: false })
  const action = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => apiClient.post('/api/partner-invitations/' + encodeURIComponent(id) + '/review', { decision }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  })
  if (isExplicitMockApiMode) return null
  const pending = query.data?.filter(item => item.categoryId === categoryId && item.reviewStatus === 'PENDING') ?? []
  return <section className="my-4 grid gap-3 rounded-xl border border-emerald-100 bg-white p-4 text-slate-900">
    <h2 className="font-bold">Registration review</h2>
    {query.isLoading && <p role="status">Loading registrations…</p>}
    {query.error && <p role="alert">{query.error.message} <button className="underline" onClick={() => void query.refetch()}>Retry</button></p>}
    {query.isSuccess && !pending.length && <p>No registrations awaiting review.</p>}
    {pending.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
      <div><strong>{item.playerName || item.registrationCode}</strong>{item.partnerName && <p>Partner: {item.partnerName}</p>}
        {item.partnerResponseStatus === 'PENDING' && <p>Waiting for partner response</p>}
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50" disabled={action.isPending} onClick={() => action.mutate({ id: item.id, decision: 'APPROVED' })}>Approve</button>
        <button className="rounded border border-red-500 px-3 py-2 text-red-700 disabled:opacity-50" disabled={action.isPending} onClick={() => { if (window.confirm('Reject this registration?')) action.mutate({ id: item.id, decision: 'REJECTED' }) }}>Reject</button>
      </div>
    </article>)}
    {action.error && <p role="alert">{action.error.message}</p>}
  </section>
}
