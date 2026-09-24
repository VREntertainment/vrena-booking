export function vatSplit(total: number) {
  const net = Math.round(total / 1.08)
  return { net, vat: Math.max(total - net, 0) }
}
