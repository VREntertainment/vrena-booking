'use client'

import { Languages } from 'lucide-react'
import { useEffect } from 'react'
import type { TranslationMap } from '../lib/i18n/base'
import type { LanguageCode } from '../lib/i18n/languages'
import { cleanMessageText } from '../lib/messageText'

export type MessageTranslationState = {
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
  useEffect(() => {
    if (translation?.loading || translation?.translatedText || translation?.error) return
    onRequestTranslation(messageKind, messageId, body, targetLanguage)
  }, [body, messageId, messageKind, onRequestTranslation, targetLanguage, translation?.error, translation?.loading, translation?.translatedText])

  const translatedText = cleanMessageText(translation?.translatedText)
  const hasTranslation = Boolean(translation?.changed && translatedText)
  const showingOriginal = Boolean(translation?.showOriginal)
  const displayBody = hasTranslation && !showingOriginal ? translatedText : body
  const hasAttemptedTranslation = Boolean(translation?.translatedText || translation?.error)
  const showTranslateAction = !translation?.loading && !hasTranslation && hasAttemptedTranslation
  const translationStatusLabel = hasTranslation
    ? text.messageTranslated
    : translation?.error || hasAttemptedTranslation
      ? text.messageTranslationUnavailable
      : text.translateMessage

  return (
    <>
      <p>{displayBody}</p>
      {translation?.loading ? (
        <div className="message-translation-row loading">
          <span className="message-translation-status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{text.translatingMessage}</span>
          </span>
        </div>
      ) : (
        <div className="message-translation-row">
          <span className="message-translation-status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{translationStatusLabel}</span>
          </span>
          {hasTranslation && (
            <button className="message-translation-toggle" type="button" onClick={onToggleOriginal}>
              {showingOriginal ? text.showTranslatedMessage : text.showOriginalMessage}
            </button>
          )}
          {showTranslateAction && (
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
      )}
    </>
  )
}
