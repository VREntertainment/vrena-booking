export type BookingUpdateAction = 'created' | 'edited' | 'cancelled' | 'deleted'
export type BookingUpdateKind = 'session' | 'ticket'

export type BookingUpdateEmailChange = {
  label: string
  before?: string | number | boolean | null
  after?: string | number | boolean | null
}

export type BookingUpdateEmailPayload = {
  action: BookingUpdateAction
  bookingKind: BookingUpdateKind
  sessionId?: string | null
  orderId?: string | null
  title?: string | null
  reference?: string | null
  date?: string | null
  time?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  total?: number | null
  summary?: string | null
  minorWarning?: string | null
  changes?: BookingUpdateEmailChange[]
  source?: string | null
}
