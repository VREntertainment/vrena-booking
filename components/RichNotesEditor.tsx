'use client'

import { useEffect, useRef } from 'react'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatNotesHtml(value: string) {
  if (!value.trim()) return ''

  if (/<\/?(strong|b|em|i|u|s|strike|br|div|p)\b/i.test(value)) {
    return value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(\/?)(strong|b|em|i|u|s|strike|br|div|p)(?:\s[^>]*)?>/gi, '<$1$2>')
      .replace(/<(?!\/?(strong|b|em|i|u|s|strike|br|div|p)\b)[^>]*>/gi, '')
  }

  return escapeHtml(value).replace(/\n/g, '<br />')
}

export default function RichNotesEditor({
  value,
  onChange,
  placeholder,
  resetKey,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  resetKey: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = valueRef.current ? formatNotesHtml(valueRef.current) : ''
    }
  }, [resetKey])

  return (
    <>
      <div
        className="rich-note-editor"
        contentEditable
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </>
  )
}
