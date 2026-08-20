import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import api from '@/api/axios'
import { ArrowLeft, Fingerprint } from 'lucide-react'

import AuthShell, { FormError, FormNotice, SubmitButton } from '@/components/AuthShell'
import { HOME_FOR, errorMessage, useAuth } from '@/context/AuthContext'

const LENGTH = 6

/**
 * One code screen for both flows. `mode="reset"` hands off to /reset-password,
 * `mode="login"` trades the code for a token and drops the user on their
 * dashboard. Only the three endpoints and the back link differ.
 */
export default function VerifyOTP({ mode = 'reset' }) {
  const navigate = useNavigate()
  const { verifyLoginOtp } = useAuth()
  const signIn = mode === 'login'
  const startOver = signIn ? '/login' : '/forgot-password'
  const email = useLocation().state?.email
  const boxes = useRef([])
  const [digits, setDigits] = useState(Array(LENGTH).fill(''))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // reached directly without an email to verify — start over
  if (!email) return <Navigate to={startOver} replace />

  const code = digits.join('')

  const focusBox = (i) => boxes.current[Math.max(0, Math.min(i, LENGTH - 1))]?.focus()

  // every update goes through the updater form — keystrokes can arrive faster than
  // a re-render, and reading `digits` from the closure would drop all but the last
  const setDigit = (i, value) => setDigits((prev) => prev.map((d, j) => (j === i ? value : d)))

  const onChange = (i) => (e) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    setDigit(i, digit)
    if (digit) focusBox(i + 1)
  }

  const onKeyDown = (i) => (e) => {
    if (e.key !== 'Backspace') return
    if (e.currentTarget.value) return // let the browser clear this box first
    if (i > 0) {
      e.preventDefault()
      setDigit(i - 1, '')
      focusBox(i - 1)
    }
  }

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!text) return
    e.preventDefault()
    setDigits(Array.from({ length: LENGTH }, (_, j) => text[j] ?? ''))
    focusBox(text.length)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (code.length !== LENGTH) return setError(`Enter all ${LENGTH} digits`)

    setBusy(true)
    try {
      if (signIn) {
        const { user } = await verifyLoginOtp(email, code)
        navigate(HOME_FOR[user.role] || '/login', { replace: true })
      } else {
        await api.post('/api/auth/verify-otp', { email, otp_code: code })
        navigate('/reset-password', { state: { email } })
      }
    } catch (err) {
      setError(errorMessage(err, 'Invalid OTP'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setNotice('')
    try {
      await api.post(signIn ? '/api/auth/resend-otp' : '/api/auth/forgot-password', { email })
      setDigits(Array(LENGTH).fill(''))
      setNotice('A new OTP has been sent')
    } catch (err) {
      setError(errorMessage(err, 'Could not resend OTP'))
    }
  }

  return (
    <AuthShell
      tile="solid"
      width={400}
      icon={Fingerprint}
      title="Enter verification code"
      subtitle="We sent a 6-digit code to your email"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex justify-center gap-2" onPaste={onPaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (boxes.current[i] = el)}
              value={digit}
              onChange={onChange(i)}
              onKeyDown={onKeyDown(i)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              autoFocus={i === 0}
              className="size-11 rounded-lg bg-white/[0.05] text-center text-lg text-on-surface ring-1 ring-white/10 transition-all outline-none focus:ring-2 focus:ring-accent-sky"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={resend}
          className="mx-auto block text-sm font-medium text-accent-sky transition-colors hover:text-on-surface"
        >
          Resend Code
        </button>

        <FormError>{error}</FormError>
        <FormNotice>{notice}</FormNotice>

        <SubmitButton busy={busy} busyLabel="Verifying…">
          Verify Code
        </SubmitButton>
      </form>

      <Link
        to={startOver}
        className="mt-5 flex items-center justify-center gap-2 text-sm text-on-surface transition-colors hover:text-accent-sky"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
    </AuthShell>
  )
}
