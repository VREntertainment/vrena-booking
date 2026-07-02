import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isLanguageCode, type LanguageCode } from '@/lib/i18n/languages'

export const runtime = 'nodejs'

const DEFAULT_TRANSLATION_MODEL = 'gpt-4.1-mini'
const OPENAI_TRANSLATION_TIMEOUT_MS = 15000
const MESSAGE_TABLES = {
  club: 'club_messages',
  session: 'session_messages',
} as const

type MessageKind = keyof typeof MESSAGE_TABLES

type TranslationPayload = {
  source_language?: string | null
  translated_text?: string
  changed?: boolean
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function bodyHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function equivalentMessageText(left: string, right: string) {
  return left.replace(/\r\n/g, '\n').trim() === right.replace(/\r\n/g, '\n').trim()
}

function getOutputText(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const outputText = (data as { output_text?: unknown }).output_text
  if (typeof outputText === 'string') return outputText

  const output = (data as { output?: unknown }).output
  if (!Array.isArray(output)) return ''

  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') parts.push(text)
    }
  }

  return parts.join('\n').trim()
}

function parseJsonObject(value: string) {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(trimmed) as TranslationPayload
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('No JSON object found.')
    return JSON.parse(trimmed.slice(start, end + 1)) as TranslationPayload
  }
}

function parseTranslation(data: unknown, originalBody: string): TranslationPayload {
  const output = getOutputText(data)
  if (!output) return { translated_text: originalBody, changed: false }

  try {
    const parsed = parseJsonObject(output)
    const translatedText = cleanString(parsed.translated_text) || originalBody
    return {
      source_language: cleanString(parsed.source_language) || null,
      translated_text: translatedText,
      changed: !equivalentMessageText(translatedText, originalBody),
    }
  } catch {
    const translatedText = output.trim() || originalBody
    return {
      translated_text: translatedText,
      changed: !equivalentMessageText(translatedText, originalBody),
    }
  }
}

function languageName(language: LanguageCode) {
  switch (language) {
    case 'de':
      return 'German'
    case 'fr':
      return 'French'
    case 'it':
      return 'Italian'
    case 'ja':
      return 'Japanese'
    case 'ko':
      return 'Korean'
    case 'vi':
      return 'Vietnamese'
    case 'en':
    default:
      return 'English'
  }
}

async function translateMessage(body: string, targetLanguage: LanguageCode) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured.')
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_TRANSLATION_MODEL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TRANSLATION_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_output_tokens: 300,
        instructions: [
          'Translate short in-app chat messages for a VR booking app.',
          'Preserve names, game titles, dates, times, prices, URLs, emojis, line breaks, and the original tone.',
          'Do not add commentary, warnings, explanations, or quote marks.',
          'If the message is already in the target language, return it unchanged and set changed to false.',
          'Return only valid JSON.',
        ].join(' '),
        input: [
          `Target language: ${languageName(targetLanguage)} (${targetLanguage})`,
          'Return JSON with source_language, translated_text, and changed.',
          'Message:',
          body,
        ].join('\n'),
        text: {
          format: {
            type: 'json_schema',
            name: 'message_translation',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                source_language: { type: 'string' },
                translated_text: { type: 'string' },
                changed: { type: 'boolean' },
              },
              required: ['source_language', 'translated_text', 'changed'],
            },
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error('Could not translate this message.')
    }

    return { model, translation: parseTranslation(await response.json(), body) }
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Message translation is not configured on this environment.', 500)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid translation payload.', 400)
  }

  const messageKind = cleanString(body.messageKind) as MessageKind
  const messageId = cleanString(body.messageId)
  const targetLanguage = cleanString(body.targetLanguage)
  const messageTable = MESSAGE_TABLES[messageKind]

  if (!messageTable || !messageId || !isLanguageCode(targetLanguage)) {
    return jsonError('Invalid translation request.', 400)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) {
    return jsonError('Log in to translate messages.', 401)
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData.user) {
    return jsonError('Invalid session token.', 401)
  }

  const { data: message, error: messageError } = await userClient
    .from(messageTable)
    .select('id, body')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    return jsonError(messageError.message, 400)
  }

  const originalBody = cleanString(message?.body)
  if (!message || !originalBody) {
    return jsonError('Message not found.', 404)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const hash = bodyHash(originalBody)

  const { data: cached, error: cacheError } = await serviceClient
    .from('message_translations')
    .select('source_language, translated_body, changed, model')
    .eq('message_table', messageTable)
    .eq('message_id', messageId)
    .eq('source_body_hash', hash)
    .eq('target_language', targetLanguage)
    .maybeSingle()

  if (cacheError) {
    return jsonError(cacheError.message, 400)
  }

  if (cached) {
    return NextResponse.json({
      sourceLanguage: cached.source_language,
      translatedText: cached.translated_body,
      changed: cached.changed,
      model: cached.model,
    })
  }

  try {
    const { model, translation } = await translateMessage(originalBody, targetLanguage)
    const translatedText = translation.translated_text || originalBody
    const changed = Boolean(translation.changed && translatedText !== originalBody)

    const { error: insertError } = await serviceClient
      .from('message_translations')
      .upsert({
        message_table: messageTable,
        message_id: messageId,
        source_body_hash: hash,
        target_language: targetLanguage,
        source_language: translation.source_language || null,
        translated_body: translatedText,
        changed,
        model,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'message_table,message_id,source_body_hash,target_language',
      })

    if (insertError) return jsonError(insertError.message, 400)

    return NextResponse.json({
      sourceLanguage: translation.source_language || null,
      translatedText,
      changed,
      model,
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Could not translate this message.', 502)
  }
}
