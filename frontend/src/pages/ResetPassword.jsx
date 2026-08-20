import { useState } from 'react'
import { ArrowLeft, Ellipsis } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import api from '@/api/axios'
import AuthShell, {
  FormError,
  PasswordField,
  PasswordStrength,
  SubmitButton,
} from '@/components/AuthShell'
import { errorMessage } from '@/utils/helpers'

export default function ResetPassword() {
  const navigate = useNavigate()
  const email = useLocation().state?.email
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // no verified email in hand — the OTP step has to happen first
  if (!email) return <Navigate to="/forgot-password" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')

    setBusy(true)
    try {
      await api.post('/api/auth/reset-password', { email, new_password: form.password })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not reset password'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      tile="solid"
      width={420}
      icon={Ellipsis}
      title="Set new password"
      subtitle="Your new password must be different from previously used passwords."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <PasswordField
            label="New Password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="h-11 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
          />
          <PasswordStrength value={form.password} variant="labeled" />
        </div>

        <PasswordField
          label="Confirm Password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          className="h-11 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
        />

        <FormError>{error}</FormError>

        <SubmitButton busy={busy} busyLabel="Saving…">
          Reset Password
        </SubmitButton>
      </form>

      <Link
        to="/login"
        className="mt-5 flex items-center justify-center gap-2 text-sm text-on-surface transition-colors hover:text-accent-sky"
      >
        <ArrowLeft className="size-4" />
        Back to log in
      </Link>
    </AuthShell>
  )
}
