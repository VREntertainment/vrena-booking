export function cleanMessageText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function equivalentMessageText(left: string, right: string) {
  return left.replace(/\r\n/g, '\n').trim() === right.replace(/\r\n/g, '\n').trim()
}
