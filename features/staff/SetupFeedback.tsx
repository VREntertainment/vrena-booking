import type { StaffConsoleCopy } from '../../lib/staff/copy'

export function SetupFeedback({ status, text }: { status: string; text: StaffConsoleCopy }) {
  if (!status) return null

  const messages = text.messages
  const success = [messages.gameSaved, messages.gamePhotoUploaded, messages.priceRuleSaved,
    messages.discountSaved, messages.voucherSaved, messages.loyaltyRuleSaved].some((message) => message === status)
  const tone = success ? 'success' : status === messages.uploadGamePhoto ? 'info' : 'error'
  return <p className="staff-setup-feedback" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>{status}</p>
}
