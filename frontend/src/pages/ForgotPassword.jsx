import { useState } from 'react'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import api from '@/api/axios'
import AuthShell, { Field, FormError, SubmitButton } from '@/components/AuthShell'
import { errorMessage } from '@/utils/helpers'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      setError(errorMessage(err, 'Could not send OTP'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      tile="round"
      width={400}
      icon={ShieldCheck}
      title="Reset your password"
      subtitle="Enter your email and we'll send you a verification code."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Email Address"
          type="email"
          icon={Mail}
          required
          autoComplete="email"
          placeholder="officer@civicpulse.gov"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyLabel="Sending…">
          Send OTP
        </SubmitButton>
      </form>

      <div className="mt-6 border-t border-outline-variant/40 pt-4">
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm text-on-surface transition-colors hover:text-accent-sky"
        >
          <ArrowLeft className="size-4" />
          Back to Login
        </Link>
      </div>
    </AuthShell>
  )
}
