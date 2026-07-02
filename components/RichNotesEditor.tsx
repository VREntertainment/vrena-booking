'use client'

import { useEffect, useRef } from 'react'
import { formatNotesHtml } from '../lib/formatNotesHtml'

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
      editorRef.current.innerHTML = valueRef.current ? formatNotesHtml(valueRef.current, { plainTextLineBreaks: true }) : ''
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
