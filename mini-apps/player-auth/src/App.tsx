import { useCallback, useEffect, useState } from 'react'
import {
  continueWithZalo,
  loadPlayerStatus,
  openVrena,
  type PlayerStatus,
} from './api'

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể kết nối tài khoản VRena. Vui lòng thử lại.'
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5.5 5.6v5.9c0 4.1 2.6 7.8 6.5 9.5 3.9-1.7 6.5-5.4 6.5-9.5V5.6L12 3Z" />
      <path d="m9.2 12 1.8 1.8 3.9-4" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.3 3.8 5.1 5.1c-1.2.7-.7 4.2 1.5 8 2.2 3.8 5 6.4 6.2 5.7l2.2-1.3c.8-.4.9-1.4.4-2.1l-1.7-2.2c-.4-.6-1.2-.7-1.8-.4l-.9.5c-.6-.5-1.2-1.2-1.7-2.1-.5-.8-.8-1.7-1-2.4l.9-.5c.6-.3.9-1.1.6-1.8L8.9 4.4c-.3-.8-1-1-1.6-.6Z" />
    </svg>
  )
}

export default function App() {
  const [status, setStatus] = useState<PlayerStatus | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setStatus(await loadPlayerStatus())
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  async function handleContinue() {
    if (!status?.linked && !acceptedTerms) {
      setError(
        'Vui lòng đồng ý cho VRena sử dụng số điện thoại Zalo của bạn và xác nhận Chính sách quyền riêng tư cùng Điều khoản sử dụng.',
      )
      return
    }

    setBusy(true)
    setError('')
    try {
      const nextStatus = await continueWithZalo(Boolean(status?.linked), acceptedTerms)
      setStatus(nextStatus)
      await openVrena(nextStatus.handoffUrl)
    } catch (continueError) {
      setError(errorMessage(continueError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="player-app" aria-busy={busy}>
      <div className="brand-shell">
        {/* The Mini App is Vite-based, so Next.js image optimization is unavailable here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="brand-logo"
          src="/brand/vrena-logo-full-light.svg"
          alt="VRena"
        />
        <span>PLAYER</span>
      </div>

      <section className="hero-art" aria-hidden="true">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/vrena-mark-light.svg" alt="" />
        <span className="verified-orb">
          <ShieldIcon />
        </span>
      </section>

      <section className="content-card">
        {busy && !status ? (
          <div className="loading-state" aria-live="polite">
            <span className="spinner" />
            <h1>Đang kết nối với Zalo…</h1>
            <p>VRena đang kiểm tra phiên đăng nhập an toàn của bạn.</p>
          </div>
        ) : status?.linked ? (
          <>
            <span className="eyebrow">TÀI KHOẢN ĐÃ XÁC MINH</span>
            <h1>Xin chào, {status.displayName || 'Người chơi'}</h1>
            <p className="lead">Tài khoản VRena của bạn đã sẵn sàng.</p>

            <div className="phone-row">
              <span className="phone-icon"><PhoneIcon /></span>
              <div>
                <small>Số điện thoại Zalo</small>
                <strong>{status.maskedPhone}</strong>
              </div>
              <span className="check-icon"><ShieldIcon /></span>
            </div>

            {error && <div className="message error-message" role="alert">{error}</div>}

            <button className="primary-button" type="button" disabled={busy} onClick={() => void handleContinue()}>
              {busy ? 'Đang mở VRena…' : 'Mở VRena'}
              <span aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <>
            <span className="eyebrow">TÀI KHOẢN VRENA</span>
            <h1>Chào mừng đến VRena</h1>
            <p className="lead">
              Dùng số điện thoại Zalo để tạo hồ sơ VRena. Không cần email.
            </p>

            <div className="benefit-row">
              <span className="benefit-icon"><PhoneIcon /></span>
              <div>
                <strong>Dữ liệu được sử dụng</strong>
                <p>
                  VRena nhận số điện thoại Zalo để tạo, bảo vệ và nhận diện tài khoản.
                  Email không bắt buộc.
                </p>
              </div>
            </div>

            <label className="consent-row">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Tôi đồng ý cho VRena nhận và sử dụng số điện thoại Zalo của tôi cho
                mục đích nêu trên. Tôi đã đọc và đồng ý với{' '}
                <a href="https://www.vre-vietnam.com/privacy-policy" target="_blank" rel="noreferrer">
                  Chính sách quyền riêng tư
                </a>{' '}
                và{' '}
                <a href="https://www.vre-vietnam.com/terms-and-conditions" target="_blank" rel="noreferrer">
                  Điều khoản sử dụng
                </a>
                .
              </span>
            </label>

            {error && <div className="message error-message" role="alert">{error}</div>}

            <button className="primary-button" type="button" disabled={busy} onClick={() => void handleContinue()}>
              {busy ? 'Đang xác minh…' : 'Tiếp tục với Zalo'}
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {!busy && !status && (
          <button className="retry-button" type="button" onClick={() => void refresh()}>
            Thử lại
          </button>
        )}
      </section>

      <footer>
        <ShieldIcon />
        <span>Kết nối được mã hóa · Tài khoản VRena vĩnh viễn</span>
      </footer>
    </main>
  )
}
