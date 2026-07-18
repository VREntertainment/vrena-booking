'use client'

import { Languages } from 'lucide-react'
import type { TranslationMap } from '../lib/i18n/base'
import type { LanguageCode } from '../lib/i18n/languages'
import { cleanMessageText } from '../lib/messageText'

export type MessageTranslationState = {
  attempted?: boolean
  loading?: boolean
  translatedText?: string
  sourceLanguage?: string | null
  changed?: boolean
  error?: string
  showOriginal?: boolean
}

type MessageBodyTextProps = {
  body: string
  messageId: string
  messageKind: 'club' | 'session'
  onToggleOriginal: () => void
  onRequestTranslation: (messageKind: 'club' | 'session', messageId: string, body: string, targetLanguage: LanguageCode) => void
  targetLanguage: LanguageCode
  text: TranslationMap
  translation?: MessageTranslationState
}

export default function MessageBodyText({
  body,
  messageId,
  messageKind,
  onToggleOriginal,
  onRequestTranslation,
  targetLanguage,
  text,
  translation,
}: MessageBodyTextProps) {
  const translatedText = cleanMessageText(translation?.translatedText)
  const hasTranslation = Boolean(translation?.changed && translatedText)
  const showingOriginal = Boolean(translation?.showOriginal)
  const displayBody = hasTranslation && !showingOriginal ? translatedText : body
  const showRetryAction = Boolean(translation?.error && translation.error !== 'login_required')
  const translationStatusLabel = translation?.error === 'login_required'
    ? text.signInToTranslate
    : translation?.error
      ? text.messageTranslationUnavailable
      : hasTranslation
        ? text.messageTranslated
        : text.messageAlreadyInLanguage

  return (
    <>
      <p>{displayBody}</p>
      {translation?.loading ? (
        <div className="message-translation-row loading">
          <span aria-live="polite" className="message-translation-status" role="status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{text.translatingMessage}</span>
          </span>
        </div>
      ) : translation?.attempted ? (
        <div className="message-translation-row">
          <span aria-live="polite" className="message-translation-status" role="status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{translationStatusLabel}</span>
          </span>
          {hasTranslation && (
            <button className="message-translation-toggle" type="button" onClick={onToggleOriginal}>
              {showingOriginal ? text.showTranslatedMessage : text.showOriginalMessage}
            </button>
          )}
          {showRetryAction && (
            <button
              aria-label={text.translateMessage}
              className="message-translation-toggle"
              type="button"
              onClick={() => onRequestTranslation(messageKind, messageId, body, targetLanguage)}
            >
              {text.translateMessage}
            </button>
          )}
        </div>
      ) : (
        <div className="message-translation-row">
          <button
            aria-label={text.translateMessage}
            className="message-translation-toggle"
            type="button"
            onClick={() => onRequestTranslation(messageKind, messageId, body, targetLanguage)}
          >
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{text.translateMessage}</span>
          </button>
        </div>
      )}
    </>
  )
}
