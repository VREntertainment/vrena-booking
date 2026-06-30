export const RATE_LIMITS = {
  login_attempt: {
    limit: 5,
    windowSeconds: 10 * 60,
  },
  otp_request: {
    limit: 3,
    windowSeconds: 10 * 60,
  },
  join_leave: {
    limit: 5,
    windowSeconds: 60,
  },
  booking_attempt: {
    limit: 3,
    windowSeconds: 60,
  },
  admin_destructive: {
    limit: 3,
    windowSeconds: 60,
  },
  password_reset: {
    limit: 3,
    windowSeconds: 10 * 60,
  },
  invite_player: {
    limit: 10,
    windowSeconds: 5 * 60,
  },
  session_message: {
    limit: 6,
    windowSeconds: 60,
  },
  customer_invite: {
    limit: 5,
    windowSeconds: 10 * 60,
  },
  voucher_quote: {
    limit: 20,
    windowSeconds: 10 * 60,
  },
  staff_config_write: {
    limit: 20,
    windowSeconds: 10 * 60,
  },
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS
