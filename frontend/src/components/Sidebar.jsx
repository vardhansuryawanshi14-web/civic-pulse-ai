import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  MapPin,
  PlusCircle,
  Users,
} from 'lucide-react'

import { Logo } from '@/components/Brand'
import LineNav from '@/components/LineNav'
import { useAuth } from '@/context/AuthContext'

export const NAV_ITEMS = {
  citizen: [
    { to: '/citizen/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/citizen/submit', label: 'Report Issue', icon: PlusCircle },
    { to: '/citizen/complaints', label: 'My Complaints', icon: List },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  officer: [
    { to: '/officer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/officer/complaints', label: 'My District Complaints', icon: ClipboardList },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/complaints', label: 'All Complaints', icon: List },
    { to: '/admin/officers', label: 'Manage Officers', icon: Users },
    { to: '/admin/map', label: 'Complaint Map', icon: MapPin },
    { to: '/admin/reports', label: 'Reports', icon: FileText },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
}

export default function Sidebar({ onNavigate, unread = 0 }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-lowest">
      <div className="flex items-center px-6 py-8">
        <Logo />
      </div>

      <div className="flex-1 px-6">
        <LineNav
          items={(NAV_ITEMS[user.role] || []).map((item) => ({
            ...item,
            badge: item.label === 'Notifications' ? unread : 0,
          }))}
          onNavigate={onNavigate}
        />
      </div>

      <div className="border-t border-border p-4">
        {/* role badge pinned at the bottom, per the global layout spec */}
        <span className="mb-2 ml-4 inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 font-label text-xs font-medium tracking-[0.05em] text-primary uppercase">
          {user.role}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center rounded-lg px-4 py-2.5 text-error transition-colors hover:bg-error-container/20"
        >
          <LogOut className="mr-4 size-5" />
          <span className="font-label text-sm font-medium tracking-[0.02em]">Logout</span>
        </button>
      </div>
    </aside>
  )
}
