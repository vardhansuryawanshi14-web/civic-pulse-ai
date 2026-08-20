import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'

import api from '@/api/axios'
import { NOTIFICATIONS_CHANGED } from '@/utils/helpers'

/** Bell with unread badge in the top navbar (PHASES.md Phase 9, task 4). */
export default function NotificationBell() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const load = () =>
      api
        .get('/api/citizen/notifications')
        .then((res) => setUnread(res.data.data.notifications.filter((n) => !n.is_read).length))
        .catch(() => {})
    load()
    window.addEventListener(NOTIFICATIONS_CHANGED, load)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, load)
  }, [])

  return (
    <Link
      to="/notifications"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-semibold text-on-error-container">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
