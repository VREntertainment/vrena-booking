'use client'

import { CheckCircle2, Eye, EyeOff, LockKeyhole, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PHONE_SETUP_MINIMUM_PASSWORD_LENGTH } from '@/lib/phoneAccountSetup'
import { supabase } from '@/lib/supabase/client'

export default function PhoneAccountSetupClient() {
  const [token, setToken] = useState('')
  const [userId, setUserId] = useState('')
  const [linkLoaded, setLinkLoaded] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)

  const hasLink = Boolean(token && userId)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const setupToken = params.get('token') || ''
    const setupUserId = params.get('uid') || ''
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    const frameId = window.requestAnimationFrame(() => {
      setToken(setupToken)
      setUserId(setupUserId)
      setLinkLoaded(true)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  async function finishSetup() {
    if (saving) return
    if (password.length < PHONE_SETUP_MINIMUM_PASSWORD_LENGTH) {
      setStatus(`Use at least ${PHONE_SETUP_MINIMUM_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }

    setSaving(true)
    setStatus('')
    try {
      const response = await fetch('/api/auth/phone-account-setup/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, token, userId }),
      })
      const payload = await response.json().catch(() => ({})) as { email?: string; error?: string }
      if (!response.ok || !payload.email) throw new Error(payload.error || 'Could not finish account setup.')

      setEmail(payload.email)
      setPassword('')
      setConfirmPassword('')
      setComplete(true)

      const { data } = await supabase.auth.getSession()
      if (data.session?.user.id === userId) {
        await supabase.auth.refreshSession()
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not finish account setup.')
    } finally {
      setSaving(false)
    }
  }

  if (complete) {
    return (
      <main className="phone-account-setup-page">
        <section className="phone-account-setup-card phone-account-setup-success">
          <CheckCircle2 aria-hidden="true" size={40} />
          <span className="phone-account-setup-eyebrow">Account ready</span>
          <h1>Email verified and password created</h1>
          <p>You can now sign in with <strong>{email}</strong> or your phone number using your new password.</p>
          <a className="primary phone-account-setup-cta" href="/profile">Continue to VRena</a>
        </section>
      </main>
    )
  }

  return (
    <main className="phone-account-setup-page">
      <section className="phone-account-setup-card">
        <div className="phone-account-setup-icon"><MailCheck aria-hidden="true" size={26} /></div>
        <span className="phone-account-setup-eyebrow">First connection</span>
        <h1>Create your private password</h1>
        <p>Your email link is verified when this password is saved. Staff will never see this password.</p>

        {!linkLoaded ? (
          <p className="notice compact-notice" role="status">Loading secure setup link…</p>
        ) : !hasLink ? (
          <p className="notice compact-notice" role="alert">This setup link is incomplete. Sign in with your phone and temporary password to request a new email.</p>
        ) : (
          <div className="phone-account-setup-form">
            <label>
              <span>New password</span>
              <div className="phone-account-setup-password-control">
                <input
                  autoComplete="new-password"
                  maxLength={128}
                  minLength={PHONE_SETUP_MINIMUM_PASSWORD_LENGTH}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} type="button">
                  {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
                </button>
              </div>
            </label>
            <label>
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                maxLength={128}
                minLength={PHONE_SETUP_MINIMUM_PASSWORD_LENGTH}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
              />
            </label>
            <p className="phone-account-setup-help"><LockKeyhole aria-hidden="true" size={15} /> Use at least {PHONE_SETUP_MINIMUM_PASSWORD_LENGTH} characters.</p>
            <button className={saving ? 'primary loading phone-account-setup-cta' : 'primary phone-account-setup-cta'} disabled={saving} onClick={finishSetup} type="button">
              {saving ? 'Creating password…' : 'Verify email and create password'}
            </button>
          </div>
        )}
        {status && <p className="notice compact-notice" role="status">{status}</p>}
        <p className="phone-account-setup-vietnamese"><strong>Tiếng Việt:</strong> Tạo mật khẩu riêng của bạn. Nhân viên VRena sẽ không nhìn thấy mật khẩu này.</p>
      </section>
    </main>
  )
}
