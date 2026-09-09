import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'

const PlayerNotificationsPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const { notifications: userNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Please log in to view notifications</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex space-x-3">
          <span className="text-sm text-gray-500">
            Unread: {unreadCount}
          </span>
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={unreadCount === 0}
          >
            Mark All as Read
          </button>
        </div>
      </div>

      {userNotifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 border rounded-lg ${notification.isRead ? 'bg-white' : 'bg-blue-50'} border-l-4 ${notification.isRead ? 'border-gray-300' : 'border-blue-500'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={notification.isRead ? 'text-gray-800' : 'text-gray-900 font-medium'}>
                    {notification.title}
                  </h3>
                  <p className={notification.isRead ? 'text-gray-600' : 'text-gray-800'} mt-1>
                    {notification.message}
                  </p>
                  {notification.link && (
                    <div className="mt-2">
                      <a
                        href={notification.link}
                        onClick={() => { if (!notification.isRead) void markAsRead(notification.id) }}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        View Details
                      </a>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    disabled={notification.isRead}
                    className={`p-2 rounded ${notification.isRead ? 'bg-gray-200 hover:bg-gray-300' : 'bg-blue-100 hover:bg-blue-200'} text-sm`}
                  >
                    {notification.isRead ? 'Read' : 'Mark Read'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  function handleMarkAsRead(id: string) {
    void markAsRead(id)
  }

  function handleMarkAllAsRead() {
    void markAllAsRead()
  }
}

export default PlayerNotificationsPage
