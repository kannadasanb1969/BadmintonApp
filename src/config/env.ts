const getApiBaseUrl = (): string => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  return apiBaseUrl || 'http://localhost:8787'
}

export { getApiBaseUrl }
export type { } // Export to make it a module
