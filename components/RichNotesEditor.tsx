'use client'

import { useEffect, useRef } from 'react'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatNotesHtml(value: string) {
  if (!value.trim()) return ''

  if (/<\/?[a-z][\s\S]*>/i.test(value)) {
    return value
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

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value ? formatNotesHtml(value) : ''
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
