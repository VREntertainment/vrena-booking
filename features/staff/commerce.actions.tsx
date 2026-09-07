'use client'

import type { ChangeEvent } from 'react'
import {
  cleanGuideTextMap,
  defaultGameGuideMaps,
  guideTextMapWithDefaults,
  isMissingStaffAudienceColumnError,
  normalizeGuideLanguage,
  normalizeGuideTextMap,
  normalizeStaffAudience,
  parseStaffArenaIds,
  slugify
} from '../../lib/staff/catalog'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  normalizeTime
} from '../../lib/staff/dates'
import {
  parseDong,
  parsePercentInput
} from '../../lib/staff/formatting'
import { defaultDiscountForm, defaultGameForm, defaultLoyaltyForm, defaultPriceForm } from '../../lib/staff/forms'
import {
  staffArenaOptions,
  staffAudienceOptions,
  staffGameImageBucket,
  staffGameImageMaxBytes,
  staffGameImageTypes
} from '../../lib/staff/options'
import {
  discountValueUnit
} from '../../lib/staff/pricing'
import type {
  StaffAudience,
  StaffDiscount,
  StaffDiscountValueUnit,
  StaffGame,
  StaffLoyaltyRule,
  StaffPriceRule
} from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'

export type CommerceActionContext = {
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  setGames: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffGame[]>>
  setPrices: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffPriceRule[]>>
  setDiscounts: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffDiscount[]>>
  setLoyaltyRules: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffLoyaltyRule[]>>
  canManageConfig: boolean
  setStatus: React.Dispatch<React.SetStateAction<string>>
  text: StaffConsoleCopy
  setGameImageUploading: React.Dispatch<React.SetStateAction<boolean>>
  gameForm: { id: string; slug: string; name: string; game_type: "other" | "shooting" | "escape" | "tournament"; duration_minutes: number; max_players_per_arena: number; number_of_rounds: number; escape_chapter_count: number; description: string; audience: import("../../lib/staff/types").StaffAudience[]; guide_language: import("../../lib/i18n/languages").LanguageCode; guide_summary: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_rules: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_tips: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; image_url: string; active: boolean; available_arena_ids: string }
  profile: import("../../lib/staff/types").StaffProfile | null
  setGameForm: React.Dispatch<React.SetStateAction<{ id: string; slug: string; name: string; game_type: "other" | "shooting" | "escape" | "tournament"; duration_minutes: number; max_players_per_arena: number; number_of_rounds: number; escape_chapter_count: number; description: string; audience: import("../../lib/staff/types").StaffAudience[]; guide_language: import("../../lib/i18n/languages").LanguageCode; guide_summary: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_rules: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_tips: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; image_url: string; active: boolean; available_arena_ids: string }>>
  consumeStaffRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string) => Promise<boolean>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  priceForm: { id: string; rule_name: string; game_id: string; day_type: "holiday" | "custom" | "weekday" | "weekend"; time_start: string; time_end: string; price_per_player: string; price_per_arena_slot: string; valid_from: string; valid_until: string; active: boolean }
  setPriceForm: React.Dispatch<React.SetStateAction<{ id: string; rule_name: string; game_id: string; day_type: "holiday" | "custom" | "weekday" | "weekend"; time_start: string; time_end: string; price_per_player: string; price_per_arena_slot: string; valid_from: string; valid_until: string; active: boolean }>>
  canCreateOrders: boolean
  commerceTab: import("../../lib/staff/types").StaffCommerceTab
  discountForm: { id: string; code: string; name: string; game_id: string; price_rule_id: string; min_players: string; max_players: string; day_scope: import("../../lib/staff/types").StaffDiscountDayScope; time_start: string; time_end: string; ticket_type: import("../../lib/staff/types").StaffDiscountTicketType; min_order_total: number; max_discount_amount: string; per_customer_limit: string; discount_type: "fixed_amount" | "percentage" | "birthday" | "free_ticket" | "resident" | "group"; value: number; valid_from: string; valid_until: string; max_uses: string; active: boolean }
  setDiscountForm: React.Dispatch<React.SetStateAction<{ id: string; code: string; name: string; game_id: string; price_rule_id: string; min_players: string; max_players: string; day_scope: import("../../lib/staff/types").StaffDiscountDayScope; time_start: string; time_end: string; ticket_type: import("../../lib/staff/types").StaffDiscountTicketType; min_order_total: number; max_discount_amount: string; per_customer_limit: string; discount_type: "fixed_amount" | "percentage" | "birthday" | "free_ticket" | "resident" | "group"; value: number; valid_from: string; valid_until: string; max_uses: string; active: boolean }>>
  loyaltyForm: { id: string; rule_name: string; game_id: string; calculation_type: "per_vnd_spent" | "per_booking" | "per_player" | "per_visit"; points_value: number; spend_amount: number; min_order_total: number; redeem_value_vnd_per_point: number; earn_trigger: "session_payment_confirmed"; rounding_rule: "floor_whole_points"; point_expiry_days: string; valid_from: string; valid_until: string; active: boolean; notes: string }
  loyaltyRules: import("../../lib/staff/types").StaffLoyaltyRule[]
  setLoyaltyForm: React.Dispatch<React.SetStateAction<{ id: string; rule_name: string; game_id: string; calculation_type: "per_vnd_spent" | "per_booking" | "per_player" | "per_visit"; points_value: number; spend_amount: number; min_order_total: number; redeem_value_vnd_per_point: number; earn_trigger: "session_payment_confirmed"; rounding_rule: "floor_whole_points"; point_expiry_days: string; valid_from: string; valid_until: string; active: boolean; notes: string }>>
  setCommerceTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffCommerceTab>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffCommerceActions(getContext: () => CommerceActionContext) {
  async function loadGames(force = false) {
    const { runStaffLoader, setGames } = getContext()

    await runStaffLoader('games', async () => {
      const { data, error } = await supabase.from('staff_games').select('*').order('name', { ascending: true })
      if (error) throw new Error(error.message)
      setGames((data ?? []) as StaffGame[])
    }, force)
  }

  async function loadPrices(force = false) {
    const { runStaffLoader, setPrices } = getContext()

    await runStaffLoader('prices', async () => {
      const { data, error } = await supabase.from('staff_pricing_rules').select('*').order('valid_from', { ascending: false })
      if (error) throw new Error(error.message)
      setPrices((data ?? []) as StaffPriceRule[])
    }, force)
  }

  async function loadDiscounts(force = false) {
    const { runStaffLoader, setDiscounts } = getContext()

    await runStaffLoader('discounts', async () => {
      const { data, error } = await supabase.from('staff_discount_rules').select('*').order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setDiscounts((data ?? []) as StaffDiscount[])
    }, force)
  }

  async function loadLoyaltyRules(force = false) {
    const { runStaffLoader, setLoyaltyRules } = getContext()

    await runStaffLoader('loyalty', async () => {
      const { data, error } = await supabase.from('staff_loyalty_rules').select('*').order('valid_from', { ascending: false }).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setLoyaltyRules((data ?? []) as StaffLoyaltyRule[])
    }, force)
  }

  async function handleGameImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const { canManageConfig, setStatus, text, setGameImageUploading, gameForm, profile, setGameForm } = getContext()

    if (!canManageConfig) return

    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!staffGameImageTypes.includes(file.type)) {
      setStatus(text.messages.gamePhotoType)
      return
    }

    if (file.size > staffGameImageMaxBytes) {
      setStatus(text.messages.gamePhotoSmall)
      return
    }

    setGameImageUploading(true)
    setStatus(text.messages.uploadGamePhoto)
    const safeName = file.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const safeGame = slugify(gameForm.slug || gameForm.name || 'game')
    const path = `${profile?.id || 'staff'}/${safeGame}-${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(staffGameImageBucket).upload(path, file, {
      contentType: file.type,
      upsert: true,
    })

    if (error) {
      setStatus(error.message)
      setGameImageUploading(false)
      return
    }

    const { data } = supabase.storage.from(staffGameImageBucket).getPublicUrl(path)
    setGameForm((current) => ({ ...current, image_url: data.publicUrl }))
    setStatus(text.messages.gamePhotoUploaded)
    setGameImageUploading(false)
  }

  async function saveGame() {
    const { canManageConfig, consumeStaffRateLimit, gameForm, setSaving, profile, setStatus, text, setGameForm, markStaffDataStale } = getContext()

    if (!canManageConfig) return
    const allowed = await consumeStaffRateLimit('staff_config_write', `game:${gameForm.id || gameForm.slug || gameForm.name}`)
    if (!allowed) return
    setSaving(true)
    const audience = normalizeStaffAudience(gameForm.audience)
    const payload = {
      slug: gameForm.slug || slugify(gameForm.name),
      name: gameForm.name.trim(),
      game_type: gameForm.game_type,
      duration_minutes: Number(gameForm.duration_minutes),
      max_players_per_arena: Number(gameForm.max_players_per_arena),
      number_of_rounds: Number(gameForm.number_of_rounds),
      escape_chapter_count: gameForm.game_type === 'escape' ? Math.max(1, Math.min(50, Number(gameForm.escape_chapter_count) || 1)) : 1,
      description: gameForm.description.trim() || null,
      difficulty: audience.join(', ') || null,
      audience,
      guide_language: normalizeGuideLanguage(gameForm.guide_language),
      guide_summary: cleanGuideTextMap(gameForm.guide_summary),
      guide_rules: cleanGuideTextMap(gameForm.guide_rules),
      guide_tips: cleanGuideTextMap(gameForm.guide_tips),
      image_url: gameForm.image_url.trim() || null,
      active: gameForm.active,
      available_arena_ids: parseStaffArenaIds(gameForm.available_arena_ids),
      created_by: profile?.id || null,
    }
    const request = gameForm.id
      ? supabase.from('staff_games').update(payload).eq('id', gameForm.id)
      : supabase.from('staff_games').insert(payload)
    let { error } = await request
    if (error && isMissingStaffAudienceColumnError(error.message)) {
      const legacyPayload = { ...payload }
      delete (legacyPayload as Partial<typeof payload>).audience
      const legacyRequest = gameForm.id
        ? supabase.from('staff_games').update(legacyPayload).eq('id', gameForm.id)
        : supabase.from('staff_games').insert(legacyPayload)
      const legacyResult = await legacyRequest
      error = legacyResult.error
    }
    setStatus(error ? error.message : text.messages.gameSaved)
    if (!error) setGameForm(defaultGameForm())
    if (!error) {
      markStaffDataStale('games', 'report')
      await loadGames(true)
    }
    setSaving(false)
  }

  async function savePrice() {
    const { canManageConfig, consumeStaffRateLimit, priceForm, setSaving, profile, setStatus, text, setPriceForm, markStaffDataStale } = getContext()

    if (!canManageConfig) return
    const allowed = await consumeStaffRateLimit('staff_config_write', `price:${priceForm.id || priceForm.rule_name}`)
    if (!allowed) return
    setSaving(true)
    const payload = {
      rule_name: priceForm.rule_name.trim(),
      game_id: priceForm.game_id || null,
      day_type: priceForm.day_type,
      time_start: priceForm.time_start || null,
      time_end: priceForm.time_end || null,
      price_per_player: parseDong(priceForm.price_per_player),
      price_per_arena_slot: parseDong(priceForm.price_per_arena_slot) > 0 ? parseDong(priceForm.price_per_arena_slot) : null,
      valid_from: priceForm.valid_from,
      valid_until: priceForm.valid_until || null,
      active: priceForm.active,
      created_by: profile?.id || null,
    }
    const request = priceForm.id
      ? supabase.from('staff_pricing_rules').update(payload).eq('id', priceForm.id)
      : supabase.from('staff_pricing_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.priceRuleSaved)
    if (!error) setPriceForm(defaultPriceForm())
    if (!error) {
      markStaffDataStale('prices')
      await loadPrices(true)
    }
    setSaving(false)
  }

  async function saveDiscount() {
    const {
      canCreateOrders,
      commerceTab,
      discountForm,
      setStatus,
      text,
      consumeStaffRateLimit,
      setSaving,
      profile,
      setDiscountForm,
      markStaffDataStale,
    } = getContext()

    if (!canCreateOrders) return
    if (commerceTab === 'vouchers' && !discountForm.code.trim()) {
      setStatus(text.messages.voucherCodeRequired)
      return
    }
    const allowed = await consumeStaffRateLimit('staff_config_write', `discount:${discountForm.id || discountForm.code || discountForm.name}`)
    if (!allowed) return
    setSaving(true)
    const isVoucher = Boolean(discountForm.code.trim())
    const payload = {
      code: discountForm.code.trim() || null,
      name: discountForm.name.trim(),
      game_id: discountForm.game_id || null,
      price_rule_id: discountForm.price_rule_id || null,
      min_players: discountForm.min_players ? Number(discountForm.min_players) : null,
      max_players: discountForm.max_players ? Number(discountForm.max_players) : null,
      day_scope: discountForm.day_scope,
      time_start: discountForm.time_start || null,
      time_end: discountForm.time_end || null,
      ticket_type: discountForm.ticket_type,
      min_order_total: Number(discountForm.min_order_total) || 0,
      max_discount_amount: discountForm.max_discount_amount ? Number(discountForm.max_discount_amount) : null,
      per_customer_limit: discountForm.per_customer_limit ? Number(discountForm.per_customer_limit) : null,
      discount_type: discountForm.discount_type,
      value: Number(discountForm.value) || 0,
      valid_from: discountForm.valid_from,
      valid_until: discountForm.valid_until || null,
      max_uses: discountForm.max_uses ? Number(discountForm.max_uses) : null,
      active: discountForm.active,
      created_by: profile?.id || null,
    }
    const request = discountForm.id
      ? supabase.from('staff_discount_rules').update(payload).eq('id', discountForm.id)
      : supabase.from('staff_discount_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : isVoucher ? text.messages.voucherSaved : text.messages.discountSaved)
    if (!error) setDiscountForm(defaultDiscountForm())
    if (!error) {
      markStaffDataStale('discounts')
      await loadDiscounts(true)
    }
    setSaving(false)
  }

  function updateDiscountType(nextType: StaffDiscount['discount_type']) {
    const { setDiscountForm } = getContext()

    setDiscountForm((current) => ({
      ...current,
      discount_type: nextType,
      value: nextType === 'free_ticket'
        ? 0
        : discountValueUnit(nextType) === 'percentage'
          ? parsePercentInput(current.value)
          : Number(current.value) || 0,
    }))
  }

  function updateDiscountValueUnit(unit: StaffDiscountValueUnit) {
    const { setDiscountForm } = getContext()

    setDiscountForm((current) => ({
      ...current,
      discount_type: unit,
      value: unit === 'percentage'
        ? parsePercentInput(current.value)
        : Number(current.value) || 0,
    }))
  }

  function updateDiscountValue(value: string) {
    const { setDiscountForm } = getContext()

    setDiscountForm((current) => ({
      ...current,
      value: discountValueUnit(current.discount_type) === 'fixed_amount'
        ? parseDong(value)
        : parsePercentInput(value),
    }))
  }

  async function saveLoyaltyRule() {
    const {
      canManageConfig,
      loyaltyForm,
      profile,
      loyaltyRules,
      text,
      consumeStaffRateLimit,
      setSaving,
      setStatus,
      setLoyaltyForm,
      markStaffDataStale,
    } = getContext()

    if (!canManageConfig) return
    const payload = {
      rule_name: loyaltyForm.rule_name.trim(),
      game_id: loyaltyForm.game_id || null,
      calculation_type: loyaltyForm.calculation_type,
      points_value: Number(loyaltyForm.points_value) || 0,
      spend_amount: Number(loyaltyForm.spend_amount) || 0,
      min_order_total: Number(loyaltyForm.min_order_total) || 0,
      redeem_value_vnd_per_point: Number(loyaltyForm.redeem_value_vnd_per_point) || 0,
      earn_trigger: loyaltyForm.earn_trigger,
      rounding_rule: loyaltyForm.rounding_rule,
      point_expiry_days: loyaltyForm.point_expiry_days ? Number(loyaltyForm.point_expiry_days) : null,
      valid_from: loyaltyForm.valid_from,
      valid_until: loyaltyForm.valid_until || null,
      active: loyaltyForm.active,
      notes: loyaltyForm.notes.trim() || null,
      created_by: profile?.id || null,
    }

    const activeRulesToDeactivate = payload.active
      ? loyaltyRules.filter((rule) => rule.active && rule.id !== loyaltyForm.id)
      : []

    if (activeRulesToDeactivate.length > 0) {
      const ruleNames = activeRulesToDeactivate.map((rule) => rule.rule_name).join(', ')
      const confirmed = window.confirm(text.messages.loyaltySingleActiveConfirm.replace('{rule}', ruleNames))
      if (!confirmed) return
    }

    const allowed = await consumeStaffRateLimit('staff_config_write', `loyalty:${loyaltyForm.id || loyaltyForm.rule_name}`)
    if (!allowed) return

    setSaving(true)
    const request = loyaltyForm.id
      ? supabase.from('staff_loyalty_rules').update(payload).eq('id', loyaltyForm.id)
      : supabase.from('staff_loyalty_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.loyaltyRuleSaved)
    if (!error) setLoyaltyForm(defaultLoyaltyForm())
    if (!error) {
      markStaffDataStale('loyalty')
      await loadLoyaltyRules(true)
    }
    setSaving(false)
  }

  function editGame(game: StaffGame) {
    const { setGameForm } = getContext()

    const defaultGuides = defaultGameGuideMaps(game.slug, game.game_type)
    setGameForm({
      id: game.id,
      slug: game.slug,
      name: game.name,
      game_type: game.game_type,
      duration_minutes: game.duration_minutes,
      max_players_per_arena: game.max_players_per_arena,
      number_of_rounds: game.number_of_rounds,
      escape_chapter_count: Math.max(1, Math.min(50, Number(game.escape_chapter_count ?? 1) || 1)),
      description: game.description || '',
      audience: normalizeStaffAudience(game.audience, game.difficulty),
      guide_language: normalizeGuideLanguage(game.guide_language),
      guide_summary: guideTextMapWithDefaults(game.guide_summary, defaultGuides.guide_summary),
      guide_rules: guideTextMapWithDefaults(game.guide_rules, defaultGuides.guide_rules),
      guide_tips: guideTextMapWithDefaults(game.guide_tips, defaultGuides.guide_tips),
      image_url: game.image_url || '',
      active: game.active,
      available_arena_ids: (game.available_arena_ids || []).join(', '),
    })
  }

  function startNewGame() {
    const { setGameForm, setStatus } = getContext()

    setGameForm(defaultGameForm())
    setStatus('')
  }

  function updateGameAudience(audience: StaffAudience, checked: boolean) {
    const { setGameForm } = getContext()

    setGameForm((current) => {
      const selected = new Set(normalizeStaffAudience(current.audience))
      if (checked) {
        selected.add(audience)
      } else {
        selected.delete(audience)
      }

      return {
        ...current,
        audience: staffAudienceOptions.filter((option) => selected.has(option)),
      }
    })
  }

  function updateGameGuideText(field: 'guide_summary' | 'guide_rules' | 'guide_tips', value: string) {
    const { setGameForm } = getContext()

    setGameForm((current) => {
      const language = normalizeGuideLanguage(current.guide_language)
      const nextGuideText = { ...normalizeGuideTextMap(current[field]) }
      if (value) {
        nextGuideText[language] = value
      } else {
        delete nextGuideText[language]
      }

      return {
        ...current,
        [field]: nextGuideText,
      }
    })
  }

  function updateGameArena(arenaId: string, checked: boolean) {
    const { setGameForm } = getContext()

    setGameForm((current) => {
      const selected = new Set(parseStaffArenaIds(current.available_arena_ids))
      if (checked) {
        selected.add(arenaId)
      } else if (selected.size > 1) {
        selected.delete(arenaId)
      }

      return {
        ...current,
        available_arena_ids: staffArenaOptions
          .filter((arena) => selected.has(arena.id))
          .map((arena) => arena.id)
          .join(', '),
      }
    })
  }

  function editPrice(rule: StaffPriceRule) {
    const { setPriceForm } = getContext()

    setPriceForm({
      id: rule.id,
      rule_name: rule.rule_name,
      game_id: rule.game_id || '',
      day_type: rule.day_type,
      time_start: normalizeTime(rule.time_start),
      time_end: normalizeTime(rule.time_end),
      price_per_player: String(rule.price_per_player),
      price_per_arena_slot: rule.price_per_arena_slot === null ? '' : String(rule.price_per_arena_slot),
      valid_from: rule.valid_from,
      valid_until: rule.valid_until || '',
      active: rule.active,
    })
  }

  function editDiscount(discount: StaffDiscount) {
    const { setCommerceTab, setDiscountForm } = getContext()

    setCommerceTab(discount.code ? 'vouchers' : 'discounts')
    setDiscountForm({
      id: discount.id,
      code: discount.code || '',
      name: discount.name,
      game_id: discount.game_id || '',
      price_rule_id: discount.price_rule_id || '',
      min_players: discount.min_players === null ? '' : String(discount.min_players),
      max_players: discount.max_players === null ? '' : String(discount.max_players),
      day_scope: discount.day_scope || 'all',
      time_start: normalizeTime(discount.time_start),
      time_end: normalizeTime(discount.time_end),
      ticket_type: discount.ticket_type || 'all',
      min_order_total: discount.min_order_total ?? 0,
      max_discount_amount: discount.max_discount_amount === null ? '' : String(discount.max_discount_amount),
      per_customer_limit: discount.per_customer_limit === null ? '' : String(discount.per_customer_limit),
      discount_type: discount.discount_type,
      value: discount.value,
      valid_from: discount.valid_from,
      valid_until: discount.valid_until || '',
      max_uses: discount.max_uses === null ? '' : String(discount.max_uses),
      active: discount.active,
    })
  }

  function editLoyaltyRule(rule: StaffLoyaltyRule) {
    const { setCommerceTab, setLoyaltyForm } = getContext()

    setCommerceTab('loyalty')
    setLoyaltyForm({
      id: rule.id,
      rule_name: rule.rule_name,
      game_id: rule.game_id || '',
      calculation_type: rule.calculation_type,
      points_value: rule.points_value,
      spend_amount: rule.spend_amount,
      min_order_total: rule.min_order_total,
      redeem_value_vnd_per_point: rule.redeem_value_vnd_per_point ?? 0,
      earn_trigger: rule.earn_trigger ?? 'session_payment_confirmed',
      rounding_rule: rule.rounding_rule ?? 'floor_whole_points',
      point_expiry_days: rule.point_expiry_days === null ? '' : String(rule.point_expiry_days),
      valid_from: rule.valid_from,
      valid_until: rule.valid_until || '',
      active: rule.active,
      notes: rule.notes || '',
    })
  }

  return {
    loadGames,
    loadPrices,
    loadDiscounts,
    loadLoyaltyRules,
    handleGameImageUpload,
    saveGame,
    savePrice,
    saveDiscount,
    updateDiscountType,
    updateDiscountValueUnit,
    updateDiscountValue,
    saveLoyaltyRule,
    editGame,
    startNewGame,
    updateGameAudience,
    updateGameGuideText,
    updateGameArena,
    editPrice,
    editDiscount,
    editLoyaltyRule,
  }
}
