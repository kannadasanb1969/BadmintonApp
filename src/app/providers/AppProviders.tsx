import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { hydrateAndSyncDomainData } from '@/api/domainDataSync'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => { void hydrateAndSyncDomainData() }, [])
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
