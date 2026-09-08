import apiClient from '@/api/apiClient'

// Request interceptor for auth token (to be implemented in future phases)
// apiClient.interceptors.request.use((config) => {
//   const token = getAuthToken() // from auth store or localStorage
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`
//   }
//   return config
// })

export default apiClient
