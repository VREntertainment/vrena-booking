import { getAccessToken, getPhoneNumber, openWebview } from 'zmp-sdk'

export const legalDocumentUrls = {
  privacyPolicy: 'https://www.vre-vietnam.com/privacy-policy',
  termsAndConditions: 'https://www.vre-vietnam.com/terms-and-conditions',
} as const

export type LegalDocument = keyof typeof legalDocumentUrls

export type PlayerStatus = {
  linked: boolean
  displayName: string
  maskedPhone: string | null
  handoffUrl?: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://vrena-booking.vercel.app').replace(/\/$/, '')

function previewState(): PlayerStatus | null {
  if (!import.meta.env.DEV) return null
  const linked = new URLSearchParams(window.location.search).get('preview') === 'linked'
  return linked
    ? {
        linked: true,
        displayName: 'Người chơi',
        maskedPhone: '+84 ••• ••• 789',
      }
    : {
        linked: false,
        displayName: 'Người chơi',
        maskedPhone: null,
      }
}

async function apiRequest(
  action: 'status' | 'continue',
  options: { phoneToken?: string; acceptedTerms?: boolean } = {},
) {
  const preview = previewState()
  if (preview) {
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    return action === 'status'
      ? preview
      : {
          linked: true,
          displayName: preview.displayName,
          maskedPhone: preview.maskedPhone || '+84 ••• ••• 789',
        }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Không thể bắt đầu phiên Zalo an toàn. Vui lòng mở lại Mini App.')

  const response = await fetch(`${apiBaseUrl}/api/zalo/player-auth`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...options }),
  })
  const payload = await response.json().catch(() => null) as (PlayerStatus & { error?: string }) | null

  if (!response.ok || !payload) {
    throw new Error(payload?.error || 'Không thể kết nối tài khoản VRena.')
  }

  return payload
}

export function loadPlayerStatus() {
  return apiRequest('status')
}

export async function continueWithZalo(linked: boolean, acceptedTerms: boolean) {
  let phoneToken: string | undefined
  if (!linked && !import.meta.env.DEV) {
    const response = await getPhoneNumber()
    phoneToken = response.token
    if (!phoneToken) throw new Error('Zalo không trả về mã xác minh số điện thoại.')
  }

  return apiRequest('continue', { phoneToken, acceptedTerms })
}

export async function openVrena(handoffUrl: string | undefined) {
  if (!handoffUrl) {
    if (import.meta.env.DEV) return
    throw new Error('VRena chưa tạo được liên kết đăng nhập an toàn.')
  }

  await openWebview({
    url: handoffUrl,
    config: {
      style: 'normal',
      leftButton: 'back',
    },
  })
}

export async function openLegalDocument(document: LegalDocument) {
  const url = legalDocumentUrls[document]

  if (import.meta.env.DEV) {
    window.location.assign(url)
    return
  }

  await openWebview({
    url,
    config: {
      style: 'normal',
      leftButton: 'back',
    },
  })
}
