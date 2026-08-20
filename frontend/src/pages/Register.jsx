import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { ArrowLeft } from 'lucide-react'

import AuthShell, {
  Divider,
  Field,
  FormError,
  GoogleButton,
  PasswordStrength,
  SubmitButton,
} from '@/components/AuthShell'
import { HOME_FOR, errorMessage, useAuth } from '@/context/AuthContext'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', ward: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={HOME_FOR[user.role] || '/login'} replace />

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')

    setBusy(true)
    try {
      const { confirm: _confirm, ...payload } = form
      const result = await register(payload)
      if (result.otp_required) {
        navigate('/verify-login', { state: { email: result.email } })
        return
      }
      navigate(HOME_FOR[result.user.role] || '/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      lockup
      width={560}
      title="Create your account"
      subtitle="Join CivicPulse to report issues in your area"
    >
      {/* Five stacked fields ran past the fold on a laptop. Pairing the short
          ones side by side on anything wider than a phone keeps the whole form,
          the Google button and the sign-in link on one screen. */}
      <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field
          label="Full Name"
          required
          placeholder="John Doe"
          value={form.name}
          onChange={set('name')}
          className="h-10 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
        />
        <Field
          label="Email Address"
          type="email"
          required
          autoComplete="email"
          placeholder="john@example.com"
          value={form.email}
          onChange={set('email')}
          className="h-10 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
        />
        <Field
          label="District"
          value={form.ward}
          onChange={set('ward')}
          placeholder="e.g. Kalwa West"
          className="h-10 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
          wrapperClassName="sm:col-span-2"
        />

        <div className="flex flex-col gap-1">
          <Field
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
            className="h-10 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
          />
          <PasswordStrength value={form.password} />
        </div>

        <Field
          label="Confirm Password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirm}
          onChange={set('confirm')}
          className="h-10 py-0 ring-1 ring-white/10 focus:ring-accent-sky"
          wrapperClassName="self-start"
        />

        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>

        <div className="sm:col-span-2">
          <SubmitButton busy={busy} busyLabel="Creating account…">
            Create Account
          </SubmitButton>
        </div>
      </form>

      <Divider />
      <GoogleButton />

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-sky transition-colors hover:underline">
          Sign In
        </Link>
      </p>

      <div className="mt-6 border-t border-outline-variant/40 pt-4">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 text-sm text-on-surface transition-colors hover:text-accent-sky"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </div>
    </AuthShell>
  )
}
