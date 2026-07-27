'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import styles from './zalo-auth.module.css'

type HandoffState = 'working' | 'success' | 'error'

export default function ZaloAuthHandoff() {
  const [state, setState] = useState<HandoffState>('working')
  const [message, setMessage] = useState('Đang bảo mật đăng nhập của bạn…')

  useEffect(() => {
    let active = true

    async function completeHandoff() {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token') || ''
      window.history.replaceState(null, '', '/auth/zalo')

      if (!token) throw new Error('Liên kết đăng nhập Zalo không hợp lệ.')

      const response = await fetch('/api/auth/zalo/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json().catch(() => null) as { tokenHash?: string; error?: string } | null
      if (!response.ok || !payload?.tokenHash) {
        throw new Error(payload?.error || 'Không thể hoàn tất đăng nhập Zalo.')
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: 'email',
      })
      if (error) throw error

      if (!active) return
      setState('success')
      setMessage('Tài khoản VRena đã sẵn sàng.')
      window.setTimeout(() => window.location.replace('/profile'), 500)
    }

    void completeHandoff().catch((error: unknown) => {
      if (!active) return
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Không thể hoàn tất đăng nhập Zalo.')
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <Image
          className={styles.logo}
          src="/brand/vrena-logo-full-light.svg"
          width={244}
          height={50}
          priority
          alt="VRena"
        />
        <div className={`${styles.statusIcon} ${styles[state]}`} aria-hidden="true">
          {state === 'working' ? <span className={styles.spinner} /> : state === 'success' ? '✓' : '!'}
        </div>
        <h1>{state === 'error' ? 'Đăng nhập chưa hoàn tất' : 'Tiếp tục đến VRena'}</h1>
        <p>{message}</p>
        {state === 'error' && (
          <p className={styles.help}>Vui lòng quay lại Zalo, mở VRena Player và thử lại.</p>
        )}
      </section>
    </main>
  )
}
