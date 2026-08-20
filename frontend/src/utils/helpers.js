export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "2h ago", "5d ago" — compact enough for a queue row. */
export function relativeTime(iso) {
  if (!iso) return ''
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Complaint reference shown to officers: CMP-0004. */
export function complaintCode(id) {
  return `CMP-${String(id).padStart(4, '0')}`
}

export function errorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || fallback
}

// The bell and the notifications page each hold their own copy of the list, so
// whichever one changes a notification tells the other to refetch.
export const NOTIFICATIONS_CHANGED = 'notifications:changed'

export function notificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}
