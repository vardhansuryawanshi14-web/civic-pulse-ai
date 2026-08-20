import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import RoleRoute from '@/components/RoleRoute'
import ForgotPassword from '@/pages/ForgotPassword'
import Login from '@/pages/Login'
import OAuthCallback from '@/pages/OAuthCallback'
import Register from '@/pages/Register'
import ResetPassword from '@/pages/ResetPassword'
import VerifyOTP from '@/pages/VerifyOTP'
import CitizenDashboard from '@/pages/citizen/CitizenDashboard'
import CitizenComplaintDetail from '@/pages/citizen/ComplaintDetail'
import MyComplaints from '@/pages/citizen/MyComplaints'
import SubmitComplaint from '@/pages/citizen/SubmitComplaint'
import ComplaintDetail from '@/pages/officer/ComplaintDetail'
import OfficerDashboard from '@/pages/officer/OfficerDashboard'
import AllComplaints from '@/pages/admin/AllComplaints'
import ManageOfficers from '@/pages/admin/ManageOfficers'
import Reports from '@/pages/admin/Reports'
import Notifications from '@/pages/Notifications'

/**
 * Split off the three heavy routes so their libraries only download when
 * someone actually opens them: the landing page pulls three.js for the fluid
 * background, the admin dashboard pulls chart.js, and the map pulls the
 * Google Maps loader. Everything else stays in the main bundle.
 */
const Landing = lazy(() => import('@/pages/Landing'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const ComplaintMap = lazy(() => import('@/pages/admin/ComplaintMap'))

function RouteFallback() {
  return <p className="p-8 text-sm text-on-surface-variant">Loading…</p>
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/notifications" element={<Notifications />} />

            <Route element={<RoleRoute roles={['citizen']} />}>
              <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
              <Route path="/citizen/submit" element={<SubmitComplaint />} />
              <Route path="/citizen/complaints" element={<MyComplaints />} />
              <Route path="/citizen/complaints/:id" element={<CitizenComplaintDetail />} />
            </Route>
            <Route element={<RoleRoute roles={['officer']} />}>
              <Route path="/officer/dashboard" element={<OfficerDashboard />} />
              {/* "My District Complaints" in the spec's officer sidebar is this same queue */}
              <Route path="/officer/complaints" element={<OfficerDashboard />} />
              <Route path="/officer/complaints/:id" element={<ComplaintDetail />} />
            </Route>
            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/complaints" element={<AllComplaints />} />
              <Route path="/admin/officers" element={<ManageOfficers />} />
              <Route path="/admin/map" element={<ComplaintMap />} />
              <Route path="/admin/reports" element={<Reports />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
