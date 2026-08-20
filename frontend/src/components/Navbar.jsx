import { useLocation } from 'react-router-dom'
import { Menu, User } from 'lucide-react'

import NotificationBell from '@/components/NotificationBell'
import { NAV_ITEMS } from '@/components/Sidebar'
import { useAuth } from '@/context/AuthContext'

const ROLE_LABEL = { citizen: 'Citizen', officer: 'Officer', admin: 'Administrator' }

function pageTitle(pathname, role) {
  const match = (NAV_ITEMS[role] || []).find((item) => pathname.startsWith(item.to))
  if (match) return match.label
  if (pathname.startsWith('/officer/complaints/')) return 'Complaint Detail'
  return ''
}

export default function Navbar({ onToggleSidebar, actions }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user) return null

  // floating glass pill, same treatment as the landing page header
  return (
    <header className="sticky top-4 z-30 px-4 pt-4 sm:px-6">
      <div className="flex h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <h2 className="text-xl font-bold text-on-surface">{pageTitle(pathname, user.role)}</h2>

        <div className="ml-auto flex items-center gap-4">
          {actions}
          <NotificationBell />
          <span className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-on-surface">{user.name}</p>
              <p className="text-xs text-on-surface-variant">
                {ROLE_LABEL[user.role] || user.role}
                {user.ward ? ` · ${user.ward}` : ''}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <User className="size-5" />
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
