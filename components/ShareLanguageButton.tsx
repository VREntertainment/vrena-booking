'use client'

import { useEffect, useEffectEvent, useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './ShareLanguageButton.module.css'

export type ShareLanguage = 'en' | 'vi'
type ShareAction = () => void | Promise<void>
export type PrepareShare = (language: ShareLanguage, signal: AbortSignal) => Promise<ShareAction>
type ShareChoice = (language: ShareLanguage) => void | Promise<void>

export function ShareLanguageButton({
  language, onShare, prepare, renderOptions, children, ...button
}: Omit<ComponentPropsWithoutRef<'button'>, 'onClick' | 'type'> & {
  language: string
  onShare?: ShareChoice
  prepare?: PrepareShare
  renderOptions?: (close: () => void) => ReactNode
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const titleId = useId()
  const vi = language === 'vi'

  useEffect(() => {
    if (host && !dialog.current?.open) dialog.current?.showModal()
  }, [host])

  function close() {
    dialog.current?.close()
    setHost(null)
    const button = trigger.current
    if (button?.getClientRects().length) button.focus()
    else button?.closest('details')?.querySelector('summary')?.focus()
  }

  return <>
    <button {...button} ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={Boolean(host)} onClick={(event) => {
      event.stopPropagation()
      // Keep the dialog in an existing modal's focus scope when Share is nested inside one.
      setHost(event.currentTarget.closest('dialog[open], .app') as HTMLElement | null ?? document.body)
    }}>{children}</button>
    {host && createPortal(
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close() }}>
        <div className={styles.heading}>
          <h2 id={titleId}>{vi ? 'Chọn ngôn ngữ chia sẻ' : 'Choose share language'}</h2>
          <button className={styles.close} type="button" onClick={close} aria-label={vi ? 'Đóng' : 'Close'}><X size={20} aria-hidden="true" /></button>
        </div>
        {renderOptions ? renderOptions(close) : <ShareLanguageOptions language={language} prepare={prepare} onShare={onShare} close={close} />}
      </dialog>,
      host,
    )}
  </>
}

export function ShareLanguageOptions({ language, prepare, onShare, close }: {
  language: string
  prepare?: PrepareShare
  onShare?: ShareChoice
  close: () => void
}) {
  const vi = language === 'vi'
  const [actions, setActions] = useState<Partial<Record<ShareLanguage, ShareAction>>>({})
  const [failed, setFailed] = useState<Partial<Record<ShareLanguage, boolean>>>({})
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const prepareLocale = useEffectEvent((locale: ShareLanguage, signal: AbortSignal) => prepare?.(locale, signal))
  const needsPreparation = Boolean(prepare)
  useEffect(() => {
    if (!needsPreparation) return
    const controller = new AbortController()
    for (const locale of ['en', 'vi'] as const) {
      void prepareLocale(locale, controller.signal)?.then((action) => {
        if (!controller.signal.aborted) setActions((current) => ({ ...current, [locale]: action }))
      }, () => {
        if (!controller.signal.aborted) setFailed((current) => ({ ...current, [locale]: true }))
      })
    }
    return () => controller.abort()
  }, [attempt, needsPreparation])

  async function share(locale: ShareLanguage) {
    setSharing(true)
    setShareError(false)
    try {
      // The action must be called before awaiting anything to retain user activation.
      if (prepare) await actions[locale]?.()
      else await onShare?.(locale)
      close()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') close()
      else setShareError(true)
    } finally {
      setSharing(false)
    }
  }

  const preparing = prepare && (['en', 'vi'] as const).some((locale) => !actions[locale] && !failed[locale])
  const preparationFailed = failed.en || failed.vi

  return <>
    <div className={styles.options}>
      <button className="secondary" type="button" lang="en" disabled={sharing || Boolean(prepare && !actions.en)} onClick={() => void share('en')}>English (EN)</button>
      <button className="secondary" type="button" lang="vi" disabled={sharing || Boolean(prepare && !actions.vi)} onClick={() => void share('vi')}>Tiếng Việt (VI)</button>
    </div>
    {preparing && <p className={styles.status} role="status">{vi ? 'Đang chuẩn bị nội dung…' : 'Preparing to share…'}</p>}
    {(preparationFailed || shareError) && <p className={styles.error} role="alert">
      {vi ? 'Không thể chia sẻ. Vui lòng thử lại.' : 'Unable to share. Please try again.'}
    </p>}
    {preparationFailed && <button className="secondary" type="button" onClick={() => {
      setActions({})
      setFailed({})
      setAttempt((value) => value + 1)
    }}>{vi ? 'Thử lại' : 'Try again'}</button>}
  </>
}
