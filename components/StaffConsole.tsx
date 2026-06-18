'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase/client'

type StaffTab = 'new' | 'today' | 'games' | 'prices' | 'discounts' | 'orders' | 'report'
type StaffRole = 'owner' | 'admin' | 'manager' | 'staff' | 'cashier' | 'viewer' | 'player'

type StaffProfile = {
  id: string
  full_name?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
}

type StaffGame = {
  id: string
  slug: string
  name: string
  game_type: 'shooting' | 'escape' | 'tournament' | 'other'
  duration_minutes: number
  max_players_per_arena: number
  number_of_rounds: number
  description: string | null
  difficulty: string | null
  image_url: string | null
  active: boolean
  available_arena_ids: string[]
}

type StaffPriceRule = {
  id: string
  rule_name: string
  game_id: string | null
  day_type: 'weekday' | 'weekend' | 'holiday' | 'custom'
  time_start: string | null
  time_end: string | null
  price_per_player: number
  price_per_arena_slot: number | null
  valid_from: string
  valid_until: string | null
  active: boolean
}

type StaffDiscount = {
  id: string
  code: string | null
  name: string
  discount_type: 'percentage' | 'fixed_amount' | 'free_ticket' | 'birthday' | 'resident' | 'group'
  value: number
  valid_from: string
  valid_until: string | null
  max_uses: number | null
  used_count: number
  active: boolean
}

type StaffOrder = {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  game_id: string | null
  session_id: string | null
  booking_date: string
  booking_time: string
  players_count: number
  arena_id: string | null
  subtotal: number
  discount_rule_id: string | null
  discount_code: string | null
  discount_total: number
  total: number
  payment_method: string
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  order_status: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded' | 'no_show' | 'completed'
  created_by: string | null
  created_at: string
  updated_at: string
  invoice_required: boolean
  company_name: string | null
  tax_code: string | null
  invoice_email: string | null
  invoice_address: string | null
  invoice_status: string
  external_invoice_id: string | null
  internal_note: string | null
}

type StaffAuditLog = {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  created_at: string
}

type BookingForm = {
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  gameId: string
  date: string
  time: string
  players: number
  arenaId: string
  discountId: string
  paymentMethod: string
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  orderStatus: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded' | 'no_show' | 'completed'
  invoiceRequired: boolean
  companyName: string
  taxCode: string
  invoiceEmail: string
  invoiceAddress: string
  note: string
}

type StaffConsoleProps = {
  profile: StaffProfile | null
  authEmail?: string
}

const todayString = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const defaultBookingForm = (): BookingForm => ({
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  gameId: '',
  date: todayString(),
  time: '09:00',
  players: 1,
  arenaId: 'arena-1',
  discountId: '',
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  orderStatus: 'confirmed',
  invoiceRequired: false,
  companyName: '',
  taxCode: '',
  invoiceEmail: '',
  invoiceAddress: '',
  note: '',
})

const defaultGameForm = () => ({
  id: '',
  slug: '',
  name: '',
  game_type: 'shooting' as StaffGame['game_type'],
  duration_minutes: 20,
  max_players_per_arena: 4,
  number_of_rounds: 1,
  description: '',
  difficulty: '',
  image_url: '',
  active: true,
  available_arena_ids: 'arena-1, arena-2',
})

const defaultPriceForm = () => ({
  id: '',
  rule_name: '',
  game_id: '',
  day_type: 'weekday' as StaffPriceRule['day_type'],
  time_start: '09:00',
  time_end: '18:00',
  price_per_player: 200000,
  price_per_arena_slot: '',
  valid_from: todayString(),
  valid_until: '',
  active: true,
})

const defaultDiscountForm = () => ({
  id: '',
  code: '',
  name: '',
  discount_type: 'percentage' as StaffDiscount['discount_type'],
  value: 10,
  valid_from: todayString(),
  valid_until: '',
  max_uses: '',
  active: true,
})

const paymentMethods = ['cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid']
const paymentStatuses = ['unpaid', 'partially_paid', 'paid', 'refunded'] as const
const orderStatuses = ['draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed'] as const
const gameTypes = ['shooting', 'escape', 'tournament', 'other'] as const
const dayTypes = ['weekday', 'weekend', 'holiday', 'custom'] as const
const discountTypes = ['percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group'] as const

function staffRank(role?: string | null, email?: string | null) {
  const normalizedEmail = email?.toLowerCase() || ''
  const normalizedRole = role?.toLowerCase() || ''
  if (normalizedEmail === 'emile@vre-vietnam.com' || normalizedEmail === 'contact@vre-vietnam.com') return 100
  if (normalizedRole === 'owner' || normalizedRole === 'admin') return 100
  if (normalizedRole === 'manager') return 80
  if (normalizedRole === 'staff' || normalizedRole === 'cashier') return 50
  if (normalizedRole === 'viewer') return 20
  return 0
}

function roleLabel(role?: string | null, email?: string | null): StaffRole {
  const rank = staffRank(role, email)
  if (rank >= 100) return (role?.toLowerCase() === 'owner' ? 'owner' : 'admin')
  if (rank >= 80) return 'manager'
  if (rank >= 50) return role?.toLowerCase() === 'cashier' ? 'cashier' : 'staff'
  if (rank >= 20) return 'viewer'
  return 'player'
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0))
}

function normalizeTime(value: string | null | undefined) {
  return (value || '').slice(0, 5)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `game-${Date.now()}`
}

function dayTypeFor(dateValue: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}

function isDateInRange(dateValue: string, from: string, until: string | null) {
  return dateValue >= from && (!until || dateValue <= until)
}

function isTimeInRule(timeValue: string, rule: StaffPriceRule) {
  const time = normalizeTime(timeValue)
  const start = normalizeTime(rule.time_start)
  const end = normalizeTime(rule.time_end)
  return (!start || time >= start) && (!end || time < end)
}

function selectPricingRule(rules: StaffPriceRule[], gameId: string, dateValue: string, timeValue: string) {
  const dayType = dayTypeFor(dateValue)
  return rules
    .filter((rule) => {
      if (!rule.active) return false
      if (rule.game_id && rule.game_id !== gameId) return false
      if (!isDateInRange(dateValue, rule.valid_from, rule.valid_until)) return false
      if (rule.day_type !== 'custom' && rule.day_type !== 'holiday' && rule.day_type !== dayType) return false
      return isTimeInRule(timeValue, rule)
    })
    .sort((left, right) => {
      if (left.game_id && !right.game_id) return -1
      if (!left.game_id && right.game_id) return 1
      if (left.day_type === 'custom' && right.day_type !== 'custom') return -1
      if (left.day_type !== 'custom' && right.day_type === 'custom') return 1
      return right.valid_from.localeCompare(left.valid_from)
    })[0] || null
}

function calculateDiscount(discount: StaffDiscount | null, subtotal: number, unitPrice: number) {
  if (!discount || !discount.active) return 0
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) return 0

  let amount = 0
  if (discount.discount_type === 'fixed_amount') amount = discount.value
  if (discount.discount_type === 'free_ticket') amount = unitPrice
  if (['percentage', 'birthday', 'resident', 'group'].includes(discount.discount_type)) {
    amount = subtotal * Math.min(discount.value, 100) / 100
  }

  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

function customerName(profile: StaffProfile) {
  return profile.nickname || profile.full_name || profile.phone || profile.email || 'Customer'
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function StaffConsole({ profile, authEmail }: StaffConsoleProps) {
  const rank = staffRank(profile?.role, profile?.email || authEmail)
  const role = roleLabel(profile?.role, profile?.email || authEmail)
  const canManageConfig = rank >= 80
  const canCreateOrders = rank >= 50
  const [activeTab, setActiveTab] = useState<StaffTab>(rank >= 50 ? 'new' : 'report')
  const [games, setGames] = useState<StaffGame[]>([])
  const [prices, setPrices] = useState<StaffPriceRule[]>([])
  const [discounts, setDiscounts] = useState<StaffDiscount[]>([])
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [profiles, setProfiles] = useState<StaffProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([])
  const [booking, setBooking] = useState<BookingForm>(() => defaultBookingForm())
  const [gameForm, setGameForm] = useState(() => defaultGameForm())
  const [priceForm, setPriceForm] = useState(() => defaultPriceForm())
  const [discountForm, setDiscountForm] = useState(() => defaultDiscountForm())
  const [reportStart, setReportStart] = useState(todayString())
  const [reportEnd, setReportEnd] = useState(todayString())
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const allowedTabs = useMemo<StaffTab[]>(() => {
    if (rank >= 80) return ['new', 'today', 'games', 'prices', 'discounts', 'orders', 'report']
    if (rank >= 50) return ['new', 'today', 'discounts', 'orders', 'report']
    return ['report']
  }, [rank])
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0]

  const activeGames = useMemo(() => games.filter((game) => game.active), [games])
  const selectedGame = useMemo(() => activeGames.find((game) => game.id === booking.gameId) || activeGames[0] || null, [activeGames, booking.gameId])
  const selectedDiscount = useMemo(() => discounts.find((discount) => discount.id === booking.discountId) || null, [booking.discountId, discounts])
  const selectedRule = useMemo(() => {
    if (!selectedGame) return null
    return selectPricingRule(prices, selectedGame.id, booking.date, booking.time)
  }, [booking.date, booking.time, prices, selectedGame])

  const quote = useMemo(() => {
    const unitPrice = selectedRule?.price_per_player || 200000
    const durationBlocks = Math.max(1, Math.ceil((selectedGame?.duration_minutes || 20) / 20))
    const subtotal = selectedRule?.price_per_arena_slot
      ? selectedRule.price_per_arena_slot * durationBlocks
      : unitPrice * booking.players
    const discountTotal = calculateDiscount(selectedDiscount, subtotal, unitPrice)
    return {
      unitPrice,
      subtotal,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal),
      ruleName: selectedRule?.rule_name || 'Default walk-in rate',
      duration: selectedGame?.duration_minutes || 20,
    }
  }, [booking.players, selectedDiscount, selectedGame, selectedRule])

  const todayOrders = useMemo(() => {
    const today = todayString()
    return orders.filter((order) => order.booking_date === today)
  }, [orders])

  const reportOrders = useMemo(() => (
    orders.filter((order) => order.booking_date >= reportStart && order.booking_date <= reportEnd)
  ), [orders, reportEnd, reportStart])

  const report = useMemo(() => {
    const paidOrders = reportOrders.filter((order) => order.payment_status === 'paid')
    const gameCounts = new Map<string, number>()
    reportOrders.forEach((order) => {
      const name = games.find((game) => game.id === order.game_id)?.name || 'Unknown'
      gameCounts.set(name, (gameCounts.get(name) || 0) + 1)
    })
    const bestSellingGame = [...gameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet'

    return {
      totalSales: reportOrders.reduce((sum, order) => sum + order.total, 0),
      totalPaid: paidOrders.reduce((sum, order) => sum + order.total, 0),
      unpaidAmount: reportOrders.filter((order) => order.payment_status !== 'paid').reduce((sum, order) => sum + order.total, 0),
      cashTotal: reportOrders.filter((order) => order.payment_method === 'cash').reduce((sum, order) => sum + order.total, 0),
      bankTransferTotal: reportOrders.filter((order) => order.payment_method === 'bank_transfer').reduce((sum, order) => sum + order.total, 0),
      momoTotal: reportOrders.filter((order) => order.payment_method === 'momo_manual').reduce((sum, order) => sum + order.total, 0),
      voucherTotal: reportOrders.filter((order) => order.payment_method === 'voucher' || order.payment_method === 'free_ticket').reduce((sum, order) => sum + order.total, 0),
      bookings: reportOrders.length,
      players: reportOrders.reduce((sum, order) => sum + order.players_count, 0),
      cancelled: reportOrders.filter((order) => order.order_status === 'cancelled').length,
      noShows: reportOrders.filter((order) => order.order_status === 'no_show').length,
      discounts: reportOrders.reduce((sum, order) => sum + order.discount_total, 0),
      bestSellingGame,
    }
  }, [games, reportOrders])

  useEffect(() => {
    void loadStaffData()
  }, [])

  async function loadStaffData() {
    setLoading(true)
    setStatus('')
    const [gamesResult, pricesResult, discountsResult, ordersResult, profilesResult, auditResult] = await Promise.all([
      supabase.from('staff_games').select('*').order('name', { ascending: true }),
      supabase.from('staff_pricing_rules').select('*').order('valid_from', { ascending: false }),
      supabase.from('staff_discount_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_orders').select('*').order('booking_date', { ascending: false }).order('booking_time', { ascending: false }).limit(250),
      supabase.from('profiles').select('id, full_name, nickname, email, phone, role').order('full_name', { ascending: true }).limit(300),
      supabase.from('audit_logs').select('id, actor_user_id, action, entity_type, entity_id, created_at').order('created_at', { ascending: false }).limit(60),
    ])

    if (gamesResult.error) setStatus(gamesResult.error.message)
    setGames((gamesResult.data ?? []) as StaffGame[])
    setPrices((pricesResult.data ?? []) as StaffPriceRule[])
    setDiscounts((discountsResult.data ?? []) as StaffDiscount[])
    setOrders((ordersResult.data ?? []) as StaffOrder[])
    setProfiles((profilesResult.data ?? []) as StaffProfile[])
    setAuditLogs((auditResult.data ?? []) as StaffAuditLog[])
    setLoading(false)
  }

  function applyCustomer(profileId: string) {
    const selected = profiles.find((item) => item.id === profileId)
    setBooking((current) => ({
      ...current,
      customerId: profileId,
      customerName: selected ? customerName(selected) : current.customerName,
      customerPhone: selected?.phone || current.customerPhone,
      customerEmail: selected?.email || current.customerEmail,
    }))
  }

  async function createOrder() {
    if (!canCreateOrders || !selectedGame) return

    setSaving(true)
    setStatus('Creating order...')
    const { data, error } = await supabase.rpc('create_staff_order', {
      p_customer_id: booking.customerId || null,
      p_customer_name: booking.customerName || null,
      p_customer_phone: booking.customerPhone || null,
      p_customer_email: booking.customerEmail || null,
      p_game_id: selectedGame.id,
      p_booking_date: booking.date,
      p_booking_time: `${booking.time}:00`,
      p_players_count: booking.players,
      p_arena_id: booking.arenaId || null,
      p_discount_rule_id: booking.discountId || null,
      p_payment_method: booking.paymentMethod,
      p_payment_status: booking.paymentStatus,
      p_order_status: booking.orderStatus,
      p_invoice_required: booking.invoiceRequired,
      p_company_name: booking.companyName || null,
      p_tax_code: booking.taxCode || null,
      p_invoice_email: booking.invoiceEmail || null,
      p_invoice_address: booking.invoiceAddress || null,
      p_internal_note: booking.note || null,
    })

    if (error) {
      setStatus(error.message)
      setSaving(false)
      return
    }

    const order = data as { order_number?: string; total?: number } | null
    setStatus(`Order ${order?.order_number || ''} confirmed · ${formatVnd(order?.total || quote.total)}`)
    setBooking(defaultBookingForm())
    await loadStaffData()
    setSaving(false)
  }

  async function saveGame() {
    if (!canManageConfig) return
    setSaving(true)
    const payload = {
      slug: gameForm.slug || slugify(gameForm.name),
      name: gameForm.name.trim(),
      game_type: gameForm.game_type,
      duration_minutes: Number(gameForm.duration_minutes),
      max_players_per_arena: Number(gameForm.max_players_per_arena),
      number_of_rounds: Number(gameForm.number_of_rounds),
      description: gameForm.description.trim() || null,
      difficulty: gameForm.difficulty.trim() || null,
      image_url: gameForm.image_url.trim() || null,
      active: gameForm.active,
      available_arena_ids: gameForm.available_arena_ids.split(',').map((item) => item.trim()).filter(Boolean),
      created_by: profile?.id || null,
    }
    const request = gameForm.id
      ? supabase.from('staff_games').update(payload).eq('id', gameForm.id)
      : supabase.from('staff_games').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : 'Game saved.')
    if (!error) setGameForm(defaultGameForm())
    await loadStaffData()
    setSaving(false)
  }

  async function savePrice() {
    if (!canManageConfig) return
    setSaving(true)
    const payload = {
      rule_name: priceForm.rule_name.trim(),
      game_id: priceForm.game_id || null,
      day_type: priceForm.day_type,
      time_start: priceForm.time_start || null,
      time_end: priceForm.time_end || null,
      price_per_player: Number(priceForm.price_per_player) || 0,
      price_per_arena_slot: priceForm.price_per_arena_slot ? Number(priceForm.price_per_arena_slot) : null,
      valid_from: priceForm.valid_from,
      valid_until: priceForm.valid_until || null,
      active: priceForm.active,
      created_by: profile?.id || null,
    }
    const request = priceForm.id
      ? supabase.from('staff_pricing_rules').update(payload).eq('id', priceForm.id)
      : supabase.from('staff_pricing_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : 'Price rule saved.')
    if (!error) setPriceForm(defaultPriceForm())
    await loadStaffData()
    setSaving(false)
  }

  async function saveDiscount() {
    if (!canCreateOrders) return
    setSaving(true)
    const payload = {
      code: discountForm.code.trim() || null,
      name: discountForm.name.trim(),
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
    setStatus(error ? error.message : 'Discount saved.')
    if (!error) setDiscountForm(defaultDiscountForm())
    await loadStaffData()
    setSaving(false)
  }

  async function updateOrder(order: StaffOrder, patch: Partial<StaffOrder>) {
    if (!canCreateOrders) return
    setSaving(true)
    const { error } = await supabase.from('staff_orders').update(patch).eq('id', order.id)
    setStatus(error ? error.message : 'Order updated.')
    await loadStaffData()
    setSaving(false)
  }

  function editGame(game: StaffGame) {
    setGameForm({
      id: game.id,
      slug: game.slug,
      name: game.name,
      game_type: game.game_type,
      duration_minutes: game.duration_minutes,
      max_players_per_arena: game.max_players_per_arena,
      number_of_rounds: game.number_of_rounds,
      description: game.description || '',
      difficulty: game.difficulty || '',
      image_url: game.image_url || '',
      active: game.active,
      available_arena_ids: (game.available_arena_ids || []).join(', '),
    })
  }

  function editPrice(rule: StaffPriceRule) {
    setPriceForm({
      id: rule.id,
      rule_name: rule.rule_name,
      game_id: rule.game_id || '',
      day_type: rule.day_type,
      time_start: normalizeTime(rule.time_start),
      time_end: normalizeTime(rule.time_end),
      price_per_player: rule.price_per_player,
      price_per_arena_slot: rule.price_per_arena_slot === null ? '' : String(rule.price_per_arena_slot),
      valid_from: rule.valid_from,
      valid_until: rule.valid_until || '',
      active: rule.active,
    })
  }

  function editDiscount(discount: StaffDiscount) {
    setDiscountForm({
      id: discount.id,
      code: discount.code || '',
      name: discount.name,
      discount_type: discount.discount_type,
      value: discount.value,
      valid_from: discount.valid_from,
      valid_until: discount.valid_until || '',
      max_uses: discount.max_uses === null ? '' : String(discount.max_uses),
      active: discount.active,
    })
  }

  function exportReport() {
    downloadCsv(`vrena-daily-report-${reportStart}-${reportEnd}.csv`, reportOrders.map((order) => ({
      order_number: order.order_number,
      date: order.booking_date,
      time: normalizeTime(order.booking_time),
      customer: order.customer_name,
      game: games.find((game) => game.id === order.game_id)?.name || '',
      players: order.players_count,
      subtotal: order.subtotal,
      discount: order.discount_total,
      total: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
    })))
  }

  const tabButton = (tab: StaffTab, label: string) => (
    allowedTabs.includes(tab) && (
      <button className={currentTab === tab ? 'active' : ''} type="button" onClick={() => setActiveTab(tab)}>
        {label}
      </button>
    )
  )

  const orderRows = (rows: StaffOrder[]) => (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Game</th>
            <th>Date</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            {canCreateOrders && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td><strong>{order.order_number}</strong></td>
              <td>{order.customer_name || order.customer_phone || order.customer_email || 'Walk-in'}</td>
              <td>{games.find((game) => game.id === order.game_id)?.name || 'Game'}</td>
              <td>{order.booking_date} · {normalizeTime(order.booking_time)}</td>
              <td>{formatVnd(order.total)}</td>
              <td>{order.payment_method}<br /><span>{order.payment_status}</span></td>
              <td>{order.order_status}</td>
              {canCreateOrders && (
                <td>
                  <div className="staff-row-actions">
                    <button type="button" onClick={() => updateOrder(order, { payment_status: 'paid', order_status: 'paid' })}>Paid</button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'completed' })}>Done</button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'no_show' })}>No-show</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={canCreateOrders ? 8 : 7}>No orders in this range.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  if (rank < 20) {
    return (
      <section className="section staff-console">
        <h2>Staff Console</h2>
        <p className="notice">Staff access required.</p>
      </section>
    )
  }

  return (
    <section className="section staff-console">
      <div className="section-head">
        <div>
          <h2>Staff Console</h2>
          <p className="muted">Counter bookings, manual payments, games, prices, discounts, and reports.</p>
        </div>
        <span className="staff-role-pill">{role}</span>
      </div>

      <div className="staff-tabs" role="tablist" aria-label="Staff Console">
        {tabButton('new', 'New Booking')}
        {tabButton('today', 'Today')}
        {tabButton('games', 'Games')}
        {tabButton('prices', 'Prices')}
        {tabButton('discounts', 'Discounts / Vouchers')}
        {tabButton('orders', 'Orders')}
        {tabButton('report', 'Daily Report')}
      </div>

      {status && <p className="notice">{status}</p>}
      {loading && <p className="notice" aria-busy="true">Loading Staff Console...</p>}

      {currentTab === 'new' && canCreateOrders && (
        <div className="staff-grid">
          <div className="staff-card staff-card-wide">
            <h3>New booking</h3>
            <div className="form-grid compact-form-grid">
              <label>
                Customer profile
                <select value={booking.customerId} onChange={(event) => applyCustomer(event.target.value)}>
                  <option value="">Walk-in / manual customer</option>
                  {profiles.map((item) => (
                    <option key={item.id} value={item.id}>{customerName(item)}</option>
                  ))}
                </select>
              </label>
              <label>
                Customer name
                <input value={booking.customerName} onChange={(event) => setBooking({ ...booking, customerName: event.target.value })} />
              </label>
              <label>
                Phone
                <input value={booking.customerPhone} onChange={(event) => setBooking({ ...booking, customerPhone: event.target.value })} />
              </label>
              <label>
                E-mail
                <input value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
              </label>
              <label>
                Game
                <select value={booking.gameId || selectedGame?.id || ''} onChange={(event) => setBooking({ ...booking, gameId: event.target.value })}>
                  {activeGames.map((game) => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={booking.date} onChange={(event) => setBooking({ ...booking, date: event.target.value })} />
              </label>
              <label>
                Time
                <input type="time" value={booking.time} onChange={(event) => setBooking({ ...booking, time: event.target.value })} />
              </label>
              <label>
                Players
                <input min={1} max={64} type="number" value={booking.players} onChange={(event) => setBooking({ ...booking, players: Number(event.target.value) })} />
              </label>
              <label>
                Arena
                <select value={booking.arenaId} onChange={(event) => setBooking({ ...booking, arenaId: event.target.value })}>
                  {(selectedGame?.available_arena_ids?.length ? selectedGame.available_arena_ids : ['arena-1']).map((arena) => (
                    <option key={arena} value={arena}>{arena}</option>
                  ))}
                </select>
              </label>
              <label>
                Discount / voucher
                <select value={booking.discountId} onChange={(event) => setBooking({ ...booking, discountId: event.target.value })}>
                  <option value="">No discount</option>
                  {discounts.filter((discount) => discount.active).map((discount) => (
                    <option key={discount.id} value={discount.id}>{discount.code ? `${discount.code} · ${discount.name}` : discount.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment method
                <select value={booking.paymentMethod} onChange={(event) => setBooking({ ...booking, paymentMethod: event.target.value })}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </label>
              <label>
                Payment status
                <select value={booking.paymentStatus} onChange={(event) => setBooking({ ...booking, paymentStatus: event.target.value as BookingForm['paymentStatus'] })}>
                  {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Order status
                <select value={booking.orderStatus} onChange={(event) => setBooking({ ...booking, orderStatus: event.target.value as BookingForm['orderStatus'] })}>
                  {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <details className="staff-invoice-details">
              <summary>Invoice details for future MISA export</summary>
              <div className="form-grid compact-form-grid">
                <label className="checkbox-row">
                  <input type="checkbox" checked={booking.invoiceRequired} onChange={(event) => setBooking({ ...booking, invoiceRequired: event.target.checked })} />
                  Invoice required
                </label>
                <label>Company<input value={booking.companyName} onChange={(event) => setBooking({ ...booking, companyName: event.target.value })} /></label>
                <label>Tax code<input value={booking.taxCode} onChange={(event) => setBooking({ ...booking, taxCode: event.target.value })} /></label>
                <label>Invoice e-mail<input value={booking.invoiceEmail} onChange={(event) => setBooking({ ...booking, invoiceEmail: event.target.value })} /></label>
                <label className="full">Invoice address<input value={booking.invoiceAddress} onChange={(event) => setBooking({ ...booking, invoiceAddress: event.target.value })} /></label>
              </div>
            </details>
            <label className="staff-note-field">
              Internal note
              <textarea value={booking.note} onChange={(event) => setBooking({ ...booking, note: event.target.value })} />
            </label>
          </div>

          <div className="staff-card staff-summary-card">
            <h3>Summary</h3>
            <div className="staff-price-lines">
              <span>Rule</span><strong>{quote.ruleName}</strong>
              <span>Duration</span><strong>{quote.duration} min</strong>
              <span>Subtotal</span><strong>{formatVnd(quote.subtotal)}</strong>
              <span>Discount</span><strong>-{formatVnd(quote.discountTotal)}</strong>
              <span>Total</span><strong>{formatVnd(quote.total)}</strong>
            </div>
            <button className={saving ? 'primary create-button loading' : 'primary create-button'} disabled={saving || !selectedGame} type="button" onClick={createOrder}>
              Confirm booking
            </button>
          </div>
        </div>
      )}

      {currentTab === 'today' && (
        <div className="staff-card">
          <h3>Today</h3>
          {orderRows(todayOrders)}
        </div>
      )}

      {currentTab === 'games' && canManageConfig && (
        <div className="staff-grid">
          <div className="staff-card">
            <h3>{gameForm.id ? 'Edit game' : 'Create game'}</h3>
            <div className="form-grid compact-form-grid">
              <label>Name<input value={gameForm.name} onChange={(event) => setGameForm({ ...gameForm, name: event.target.value })} /></label>
              <label>Slug<input value={gameForm.slug} onChange={(event) => setGameForm({ ...gameForm, slug: event.target.value })} /></label>
              <label>Type<select value={gameForm.game_type} onChange={(event) => setGameForm({ ...gameForm, game_type: event.target.value as StaffGame['game_type'] })}>{gameTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Duration<input type="number" value={gameForm.duration_minutes} onChange={(event) => setGameForm({ ...gameForm, duration_minutes: Number(event.target.value) })} /></label>
              <label>Max players / arena<input type="number" value={gameForm.max_players_per_arena} onChange={(event) => setGameForm({ ...gameForm, max_players_per_arena: Number(event.target.value) })} /></label>
              <label>Rounds<input type="number" value={gameForm.number_of_rounds} onChange={(event) => setGameForm({ ...gameForm, number_of_rounds: Number(event.target.value) })} /></label>
              <label>Difficulty<input value={gameForm.difficulty} onChange={(event) => setGameForm({ ...gameForm, difficulty: event.target.value })} /></label>
              <label>Image URL<input value={gameForm.image_url} onChange={(event) => setGameForm({ ...gameForm, image_url: event.target.value })} /></label>
              <label className="full">Arena IDs<input value={gameForm.available_arena_ids} onChange={(event) => setGameForm({ ...gameForm, available_arena_ids: event.target.value })} /></label>
              <label className="full">Description<textarea value={gameForm.description} onChange={(event) => setGameForm({ ...gameForm, description: event.target.value })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={gameForm.active} onChange={(event) => setGameForm({ ...gameForm, active: event.target.checked })} /> Active</label>
            </div>
            <button className="primary" type="button" disabled={saving || !gameForm.name.trim()} onClick={saveGame}>Save game</button>
          </div>
          <div className="staff-card">
            <h3>Games</h3>
            {games.map((game) => (
              <button className="staff-list-item" key={game.id} type="button" onClick={() => editGame(game)}>
                <strong>{game.name}</strong>
                <span>{game.game_type} · {game.duration_minutes} min · {game.active ? 'active' : 'inactive'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'prices' && canManageConfig && (
        <div className="staff-grid">
          <div className="staff-card">
            <h3>{priceForm.id ? 'Edit price rule' : 'Create price rule'}</h3>
            <div className="form-grid compact-form-grid">
              <label>Rule name<input value={priceForm.rule_name} onChange={(event) => setPriceForm({ ...priceForm, rule_name: event.target.value })} /></label>
              <label>Game<select value={priceForm.game_id} onChange={(event) => setPriceForm({ ...priceForm, game_id: event.target.value })}><option value="">All games</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
              <label>Day type<select value={priceForm.day_type} onChange={(event) => setPriceForm({ ...priceForm, day_type: event.target.value as StaffPriceRule['day_type'] })}>{dayTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Start<input type="time" value={priceForm.time_start} onChange={(event) => setPriceForm({ ...priceForm, time_start: event.target.value })} /></label>
              <label>End<input type="time" value={priceForm.time_end} onChange={(event) => setPriceForm({ ...priceForm, time_end: event.target.value })} /></label>
              <label>Price / player<input type="number" value={priceForm.price_per_player} onChange={(event) => setPriceForm({ ...priceForm, price_per_player: Number(event.target.value) })} /></label>
              <label>Price / arena slot<input type="number" value={priceForm.price_per_arena_slot} onChange={(event) => setPriceForm({ ...priceForm, price_per_arena_slot: event.target.value })} /></label>
              <label>Valid from<input type="date" value={priceForm.valid_from} onChange={(event) => setPriceForm({ ...priceForm, valid_from: event.target.value })} /></label>
              <label>Valid until<input type="date" value={priceForm.valid_until} onChange={(event) => setPriceForm({ ...priceForm, valid_until: event.target.value })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={priceForm.active} onChange={(event) => setPriceForm({ ...priceForm, active: event.target.checked })} /> Active</label>
            </div>
            <button className="primary" type="button" disabled={saving || !priceForm.rule_name.trim()} onClick={savePrice}>Save price</button>
          </div>
          <div className="staff-card">
            <h3>Price rules</h3>
            {prices.map((rule) => (
              <button className="staff-list-item" key={rule.id} type="button" onClick={() => editPrice(rule)}>
                <strong>{rule.rule_name}</strong>
                <span>{rule.day_type} · {normalizeTime(rule.time_start) || 'any'}-{normalizeTime(rule.time_end) || 'any'} · {formatVnd(rule.price_per_player)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'discounts' && canCreateOrders && (
        <div className="staff-grid">
          <div className="staff-card">
            <h3>{discountForm.id ? 'Edit discount' : 'Create discount'}</h3>
            <div className="form-grid compact-form-grid">
              <label>Code<input value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} /></label>
              <label>Name<input value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} /></label>
              <label>Type<select value={discountForm.discount_type} onChange={(event) => setDiscountForm({ ...discountForm, discount_type: event.target.value as StaffDiscount['discount_type'] })}>{discountTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Value<input type="number" value={discountForm.value} onChange={(event) => setDiscountForm({ ...discountForm, value: Number(event.target.value) })} /></label>
              <label>Valid from<input type="date" value={discountForm.valid_from} onChange={(event) => setDiscountForm({ ...discountForm, valid_from: event.target.value })} /></label>
              <label>Valid until<input type="date" value={discountForm.valid_until} onChange={(event) => setDiscountForm({ ...discountForm, valid_until: event.target.value })} /></label>
              <label>Max uses<input type="number" value={discountForm.max_uses} onChange={(event) => setDiscountForm({ ...discountForm, max_uses: event.target.value })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={discountForm.active} onChange={(event) => setDiscountForm({ ...discountForm, active: event.target.checked })} /> Active</label>
            </div>
            <button className="primary" type="button" disabled={saving || !discountForm.name.trim()} onClick={saveDiscount}>Save discount</button>
          </div>
          <div className="staff-card">
            <h3>Discounts / vouchers</h3>
            {discounts.map((discount) => (
              <button className="staff-list-item" key={discount.id} type="button" onClick={() => editDiscount(discount)}>
                <strong>{discount.code ? `${discount.code} · ${discount.name}` : discount.name}</strong>
                <span>{discount.discount_type} · {discount.value} · used {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'orders' && (
        <div className="staff-card">
          <h3>Orders</h3>
          {orderRows(orders)}
        </div>
      )}

      {currentTab === 'report' && (
        <div className="staff-card">
          <div className="staff-report-head">
            <h3>Daily report</h3>
            <div className="staff-report-filters">
              <button type="button" onClick={() => { const date = todayString(); setReportStart(date); setReportEnd(date) }}>Today</button>
              <button type="button" onClick={() => {
                const date = new Date()
                date.setDate(date.getDate() - 1)
                const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                setReportStart(value)
                setReportEnd(value)
              }}>Yesterday</button>
              <input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} />
              <input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} />
              <button type="button" onClick={exportReport}>Export CSV</button>
            </div>
          </div>
          <div className="staff-summary-grid">
            <div><span>Total sales</span><strong>{formatVnd(report.totalSales)}</strong></div>
            <div><span>Total paid</span><strong>{formatVnd(report.totalPaid)}</strong></div>
            <div><span>Unpaid</span><strong>{formatVnd(report.unpaidAmount)}</strong></div>
            <div><span>Cash</span><strong>{formatVnd(report.cashTotal)}</strong></div>
            <div><span>Bank transfer</span><strong>{formatVnd(report.bankTransferTotal)}</strong></div>
            <div><span>Momo manual</span><strong>{formatVnd(report.momoTotal)}</strong></div>
            <div><span>Voucher / free</span><strong>{formatVnd(report.voucherTotal)}</strong></div>
            <div><span>Bookings</span><strong>{report.bookings}</strong></div>
            <div><span>Players</span><strong>{report.players}</strong></div>
            <div><span>Cancelled</span><strong>{report.cancelled}</strong></div>
            <div><span>No-shows</span><strong>{report.noShows}</strong></div>
            <div><span>Discounts</span><strong>{formatVnd(report.discounts)}</strong></div>
            <div><span>Best-selling game</span><strong>{report.bestSellingGame}</strong></div>
          </div>
          {orderRows(reportOrders)}
          <h3 className="staff-audit-title">Recent audit log</h3>
          <div className="staff-audit-list">
            {auditLogs.map((log) => (
              <span key={log.id}>{new Date(log.created_at).toLocaleString()} · {log.action} · {log.entity_type}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
