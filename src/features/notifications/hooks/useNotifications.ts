import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import { useAuthStore } from '@/store/authStore'
import { AppNotification } from '@/features/notifications/types/notification.types'
import { useEffect, useMemo } from 'react'
import { notificationApiService } from '@/features/notifications/services/notificationApiService'
import { isExplicitMockApiMode } from '@/api/apiClient'

export const useNotifications = () => {
  // Use Zustand selectors for reactivity - get stable references
  const user = useAuthStore(state => state.user)
  const notifications = useNotificationStore(state => state.notifications)
  const backendUnreadCount = useNotificationStore(state => state.unreadCount)
  const clearRecipientNotifications = useNotificationStore(state => state.clearRecipientNotifications)

  useEffect(() => {
    if (user) void notificationApiService.refresh(user.id)
  }, [user?.id])

  // Derive user-specific notifications outside of Zustand selector
  const userNotifications = useMemo(() => {
    if (!user) {
      return []
    }

    return notifications
      .filter(notification =>
        notification.recipientId === user.id &&
        notification.recipientRole === user.role
      )
      .slice() // Create a shallow copy to avoid mutating original array
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
  }, [notifications, user])

  // Derive unread count from userNotifications
  const unreadCount = isExplicitMockApiMode ? userNotifications.filter(notification => !notification.isRead).length : backendUnreadCount

  return {
    notifications: userNotifications,
    unreadCount,
    markAsRead: (notificationId: string) => user ? notificationApiService.markRead(notificationId, user.id) : Promise.resolve(undefined),
    markAllAsRead: () => user ? notificationApiService.markAllRead(user.id) : Promise.resolve(),
    clear: () => {
      if (user) {
        clearRecipientNotifications(user.id, user.role)
      }
    }
  }
}
