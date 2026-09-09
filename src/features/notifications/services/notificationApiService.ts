import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { AppNotification } from '@/features/notifications/types/notification.types'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'

const cache = (notifications: AppNotification[]) => useNotificationStore.getState().replaceNotifications(notifications)

export const notificationApiService = {
  getNotifications: async (userId: string): Promise<AppNotification[]> => {
    if (isExplicitMockApiMode) return useNotificationStore.getState().notifications.filter((item) => item.recipientId === userId)
    const data = (await apiClient.get<AppNotification[]>(`/api/notifications?userId=${encodeURIComponent(userId)}`)).data
    const notifications = Array.isArray(data) ? data : []; cache(notifications); return notifications
  },
  getUnreadCount: async (userId: string): Promise<number> => {
    if (isExplicitMockApiMode) return useNotificationStore.getState().notifications.filter((item) => item.recipientId === userId && !item.isRead).length
    const data = (await apiClient.get<{ count: number }>(`/api/notifications/unread-count?userId=${encodeURIComponent(userId)}`)).data
    const count = Number.isFinite(data?.count) ? data.count : 0; useNotificationStore.getState().setUnreadCount(count); return count
  },
  refresh: async (userId: string) => Promise.all([notificationApiService.getNotifications(userId), notificationApiService.getUnreadCount(userId)]),
  markRead: async (notificationId: string, userId: string): Promise<AppNotification> => {
    if (isExplicitMockApiMode) { useNotificationStore.getState().markAsRead(notificationId); return useNotificationStore.getState().notifications.find((item) => item.id === notificationId)! }
    const notification = (await apiClient.post<AppNotification>(`/api/notifications/read/${notificationId}?userId=${encodeURIComponent(userId)}`)).data
    await notificationApiService.refresh(userId); return notification
  },
  markAllRead: async (userId: string): Promise<void> => {
    if (isExplicitMockApiMode) return
    await apiClient.post(`/api/notifications/read-all?userId=${encodeURIComponent(userId)}`)
    await notificationApiService.refresh(userId)
  },
}
