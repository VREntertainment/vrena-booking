'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export default function BookingGuestDialog({ title, busy, onClose, children }: {
  title: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input[type="tel"]')?.focus()
    return () => dialog.close()
  }, [])

  return <dialog ref={ref} className="login-modal guest-ticket-modal" aria-label={title}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    {children}
  </dialog>
}
