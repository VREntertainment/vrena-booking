import { isLanguageCode } from '../../../../lib/i18n/languages'

const defaultContentStudioOrigin = 'https://vre-vietnam.com'

function getContentStudioOrigin() {
  const configuredOrigin =
    process.env.VRENA_CONTENT_STUDIO_ORIGIN?.trim() || defaultContentStudioOrigin

  try {
    return new URL(configuredOrigin).origin
  } catch {
    return defaultContentStudioOrigin
  }
}

function isCopyMap(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string'),
  )
}

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en'

  if (!isLanguageCode(locale)) {
    return Response.json({ error: 'Unsupported web app language.' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${getContentStudioOrigin()}/api/content-studio/published-webapp-copy?locale=${locale}`,
      { cache: 'no-store' },
    )

    if (!response.ok) {
      throw new Error(`Content Studio returned ${response.status}.`)
    }

    const payload = (await response.json()) as { copy?: unknown }

    if (!isCopyMap(payload.copy) || Object.keys(payload.copy).length > 2_000) {
      throw new Error('Content Studio copy response is invalid.')
    }

    return Response.json(
      { copy: payload.copy },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return Response.json(
      { copy: {} },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
