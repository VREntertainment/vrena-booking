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
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS
