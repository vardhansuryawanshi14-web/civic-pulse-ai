import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Lock, Mail } from 'lucide-react'

import AuthShell, {
  Checkbox,
  Divider,
  Field,
  FormError,
  GoogleButton,
  PasswordField,
  SubmitButton,
} from '@/components/AuthShell'
import { HOME_FOR, errorMessage, useAuth } from '@/context/AuthContext'

const OAUTH_ERRORS = {
  google_failed: 'Google sign-in failed. Try again.',
  deactivated: 'This account has been deactivated.',
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [error, setError] = useState(OAUTH_ERRORS[params.get('error')] || '')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={HOME_FOR[user.role] || '/login'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const me = await login(form.email, form.password, form.remember)
      navigate(HOME_FOR[me.role] || '/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      lockup
      title="Welcome back"
      subtitle="Sign in to continue to your dashboard"
    >
      <form onSubmit={submit} className="flex w-full flex-col gap-4">
        <Field
          label="Email"
          type="email"
          icon={Mail}
          required
          autoComplete="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordField
          label="Password"
          icon={Lock}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <Checkbox
            label="Remember me"
            checked={form.remember}
            onChange={(e) => setForm({ ...form, remember: e.target.checked })}
          />
          <Link
            to="/forgot-password"
            className="font-label text-sm font-medium tracking-[0.02em] text-accent-sky transition-colors hover:text-on-surface"
          >
            Forgot Password?
          </Link>
        </div>

        <FormError>{error}</FormError>

        <SubmitButton busy={busy} busyLabel="Signing In…">
          Sign In
        </SubmitButton>
      </form>

      <Divider />
      <GoogleButton />

      <p className="mt-2 text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="ml-1 font-label font-medium text-accent-sky transition-colors hover:text-on-surface"
        >
          Register
        </Link>
      </p>
    </AuthShell>
  )
}
