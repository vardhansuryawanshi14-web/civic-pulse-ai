import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FileText, Info, RefreshCw, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import api from '@/api/axios'
import { useAuth } from '@/context/AuthContext'
import { errorMessage, notificationsChanged, relativeTime } from '@/utils/helpers'

/**
 * The backend stores one message string per notification, so the type is read
 * back off that message rather than a column.
 */
function classify(message = '') {
  if (/critical|urgent|high priority/i.test(message))
    return { title: 'Priority Escalation', Icon: AlertTriangle, tone: 'error' }
  if (/assigned/i.test(message))
    return { title: 'New Assignment', Icon: UserPlus, tone: 'neutral' }
  if (/resolved/i.test(message))
    return { title: 'Status Update', Icon: CheckCircle2, tone: 'tertiary' }
  if (/in progress|is now/i.test(message))
    return { title: 'Status Update', Icon: RefreshCw, tone: 'primary' }
  if (/received|classified/i.test(message))
    return { title: 'Complaint Received', Icon: FileText, tone: 'primary' }
  return { title: 'System Update', Icon: Info, tone: 'neutral' }
}

const TONE = {
  error: { bar: 'bg-error', icon: 'bg-error/15 text-error' },
  tertiary: { bar: 'bg-tertiary', icon: 'bg-tertiary/15 text-tertiary' },
  primary: { bar: 'bg-primary', icon: 'bg-primary/15 text-primary' },
  neutral: { bar: 'bg-outline', icon: 'bg-surface-container text-on-surface-variant' },
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () =>
    api
      .get('/api/citizen/notifications')
      .then((res) => setNotifications(res.data.data.notifications))
      .catch((err) => setError(errorMessage(err, 'Could not load notifications')))

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const unread = notifications.filter((n) => !n.is_read).length

  const markAllRead = async () => {
    setError('')
    try {
      await api.patch('/api/citizen/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      notificationsChanged()
    } catch (err) {
      setError(errorMessage(err, 'Could not mark notifications as read'))
    }
  }

  // opens the complaint in whichever view this role is allowed to see
  const open = async (n) => {
    if (!n.is_read) {
      await api.patch(`/api/citizen/notifications/${n.id}`).catch(() => {})
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      notificationsChanged()
    }
    if (!n.complaint_id) return
    if (user.role === 'officer') navigate(`/officer/complaints/${n.complaint_id}`)
    else if (user.role === 'citizen') navigate(`/citizen/complaints/${n.complaint_id}`)
    else navigate('/admin/complaints')
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-on-surface">Notifications</h1>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-sm font-medium text-accent-sky transition-colors hover:text-on-surface"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-on-surface-variant">Loading…</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-error">
          {error}
        </p>
      )}
      {!loading && !error && notifications.length === 0 && (
        <p className="mt-6 text-sm text-on-surface-variant">No notifications yet.</p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {notifications.map((n, i) => {
          const { title, Icon, tone } = classify(n.message)
          const style = TONE[tone]
          return (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            >
              <button
                type="button"
                onClick={() => open(n)}
                className={`relative flex w-full gap-3 overflow-hidden rounded-2xl border p-4 pl-5 text-left transition-colors ${
                  n.is_read
                    ? 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]'
                    : 'border-white/14 bg-[rgba(26,26,29,0.75)] shadow-[0_4px_18px_rgba(0,0,0,0.45)] hover:border-accent-sky/35'
                }`}
              >
                {!n.is_read && <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />}

                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    n.is_read ? 'bg-surface-container text-on-surface-variant' : style.icon
                  }`}
                >
                  <Icon className="size-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-on-surface">{title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-on-surface-variant">
                      {!n.is_read && <span className="size-1.5 rounded-full bg-primary" />}
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-on-surface-variant">{n.message}</span>
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
