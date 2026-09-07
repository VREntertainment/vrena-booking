'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { updateCaptchaTokenState, warmSupabaseClientState, type AuthCredentialsActionContext } from './authCredentials.actions'
import { clearSessionMessageState, type SessionMessagesActionContext } from './sessionMessages.actions'

type LifecycleInput = Pick<AuthCredentialsActionContext, 'captchaTokenRef' | 'setCaptchaToken' | 'warmedSupabaseClientRef'>
  & Pick<SessionMessagesActionContext, 'sessionMessagesLoadedRef' | 'sessionMessagesLoadingRef' | 'setSessionMessages' | 'setSessionMessagePages'>
  & { setTicketStatus: Dispatch<SetStateAction<string>>; setTicketStatusVariant: Dispatch<SetStateAction<'info' | 'error'>> }

/** Stable lifecycle callbacks keep CAPTCHA and subscriptions mounted across ordinary form updates. */
export function useBookingLifecycleActions({
  captchaTokenRef,
  setCaptchaToken,
  warmedSupabaseClientRef,
  sessionMessagesLoadedRef,
  sessionMessagesLoadingRef,
  setSessionMessages,
  setSessionMessagePages,
  setTicketStatus,
  setTicketStatusVariant,
}: LifecycleInput) {
  const updateCaptchaToken = useCallback((token: string) => updateCaptchaTokenState({ captchaTokenRef, setCaptchaToken }, token), [captchaTokenRef, setCaptchaToken])
  const warmSupabaseClient = useCallback(() => warmSupabaseClientState({ warmedSupabaseClientRef }), [warmedSupabaseClientRef])
  const resetSessionMessageState = useCallback(() => clearSessionMessageState({ sessionMessagesLoadedRef, sessionMessagesLoadingRef, setSessionMessages, setSessionMessagePages }), [sessionMessagesLoadedRef, sessionMessagesLoadingRef, setSessionMessages, setSessionMessagePages])
  const clearTicketStatus = useCallback(() => {
    setTicketStatus('')
    setTicketStatusVariant('info')
  }, [setTicketStatus, setTicketStatusVariant])
  return { updateCaptchaToken, warmSupabaseClient, resetSessionMessageState, clearTicketStatus }
}
