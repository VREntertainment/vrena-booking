const allowedNotesTagPattern = /<\/?(strong|b|em|i|u|s|strike|br|div|p)\b/i

type FormatNotesHtmlOptions = {
  markdownShortcuts?: boolean
  plainTextLineBreaks?: boolean
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function formatNotesHtml(value: string, options: FormatNotesHtmlOptions = {}) {
  if (!value.trim()) return ''

  if (allowedNotesTagPattern.test(value)) {
    return value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(\/?)(strong|b|em|i|u|s|strike|br|div|p)(?:\s[^>]*)?>/gi, '<$1$2>')
      .replace(/<(?!\/?(strong|b|em|i|u|s|strike|br|div|p)\b)[^>]*>/gi, '')
  }

  const escaped = escapeHtml(value)

  if (options.markdownShortcuts) {
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/(^|[^*])\*(?!\*)(.+?)\*/g, '$1<em>$2</em>')
  }

  return options.plainTextLineBreaks ? escaped.replace(/\n/g, '<br />') : escaped
}
