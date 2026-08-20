import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import api from '@/api/axios'
import { GlowBackground } from '@/components/Brand'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import { PageTransition } from '@/components/motion'
import { NOTIFICATIONS_CHANGED } from '@/utils/helpers'

/** Shell for every signed-in screen: same glow, same sidebar, same top bar. */
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // the sidebar badge is the only place unread count is shown now
  useEffect(() => {
    const load = () =>
      api
        .get('/api/citizen/notifications')
        .then((res) => setUnread(res.data.data.notifications.filter((n) => !n.is_read).length))
        .catch(() => {})
    load()
    window.addEventListener(NOTIFICATIONS_CHANGED, load)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, load)
  }, [pathname])

  return (
    <div className="relative min-h-screen text-on-surface">
      <GlowBackground />

      <div className="relative z-10 flex">
        <div className="sticky top-0 hidden h-screen lg:block">
          <Sidebar unread={unread} />
        </div>

        {drawerOpen && (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-40 lg:hidden">
              <Sidebar unread={unread} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar onToggleSidebar={() => setDrawerOpen((v) => !v)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <PageTransition key={pathname}>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </div>
    </div>
  )
}
