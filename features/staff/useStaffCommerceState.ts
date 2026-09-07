'use client'

import { useState } from 'react'
import { defaultDiscountForm, defaultGameForm, defaultLoyaltyForm, defaultPriceForm } from '../../lib/staff/forms'
import type {
  StaffDiscount,
  StaffGame,
  StaffLoyaltyRule,
  StaffPriceRule
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffCommerceState() {
  const [games, setGames] = useState<StaffGame[]>([])
  const [prices, setPrices] = useState<StaffPriceRule[]>([])
  const [discounts, setDiscounts] = useState<StaffDiscount[]>([])
  const [loyaltyRules, setLoyaltyRules] = useState<StaffLoyaltyRule[]>([])
  const [gameForm, setGameForm] = useState(() => defaultGameForm())
  const [priceForm, setPriceForm] = useState(() => defaultPriceForm())
  const [discountForm, setDiscountForm] = useState(() => defaultDiscountForm())
  const [loyaltyForm, setLoyaltyForm] = useState(() => defaultLoyaltyForm())
  const [gameImageUploading, setGameImageUploading] = useState(false)
  return {
    games,
    setGames,
    prices,
    setPrices,
    discounts,
    setDiscounts,
    loyaltyRules,
    setLoyaltyRules,
    gameForm,
    setGameForm,
    priceForm,
    setPriceForm,
    discountForm,
    setDiscountForm,
    loyaltyForm,
    setLoyaltyForm,
    gameImageUploading,
    setGameImageUploading,
  }
}
