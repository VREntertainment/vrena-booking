'use client'

import {
  Save
} from 'lucide-react'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  formatDongInput,
  formatPercentInput,
  formatVnd
} from '../../lib/staff/formatting'
import {
  discountTypes,
  loyaltyCalculationTypes,
  staffCommerceTabs,
  staffDiscountDayScopes,
  staffDiscountTicketTypes
} from '../../lib/staff/options'
import {
  formatDiscountRuleConditions,
  formatDiscountRuleValue,
  loyaltyCalculationLabel
} from '../../lib/staff/pricing'
import type {
  StaffDiscount,
  StaffDiscountDayScope,
  StaffDiscountTicketType,
  StaffDiscountValueUnit,
  StaffLoyaltyRule
} from '../../lib/staff/types'
import { ButtonIconText } from './shared'

export type DiscountsSectionProps = {
  canEditCommerceTab: boolean
  text: StaffConsoleCopy
  commerceTab: import("../../lib/staff/types").StaffCommerceTab
  loyaltyForm: { id: string; rule_name: string; game_id: string; calculation_type: "per_vnd_spent" | "per_booking" | "per_player" | "per_visit"; points_value: number; spend_amount: number; min_order_total: number; redeem_value_vnd_per_point: number; earn_trigger: "session_payment_confirmed"; rounding_rule: "floor_whole_points"; point_expiry_days: string; valid_from: string; valid_until: string; active: boolean; notes: string }
  setLoyaltyForm: React.Dispatch<React.SetStateAction<{ id: string; rule_name: string; game_id: string; calculation_type: "per_vnd_spent" | "per_booking" | "per_player" | "per_visit"; points_value: number; spend_amount: number; min_order_total: number; redeem_value_vnd_per_point: number; earn_trigger: "session_payment_confirmed"; rounding_rule: "floor_whole_points"; point_expiry_days: string; valid_from: string; valid_until: string; active: boolean; notes: string }>>
  games: import("../../lib/staff/types").StaffGame[]
  saving: boolean
  saveLoyaltyRule: () => Promise<void>
  discountForm: { id: string; code: string; name: string; game_id: string; price_rule_id: string; min_players: string; max_players: string; day_scope: import("../../lib/staff/types").StaffDiscountDayScope; time_start: string; time_end: string; ticket_type: import("../../lib/staff/types").StaffDiscountTicketType; min_order_total: number; max_discount_amount: string; per_customer_limit: string; discount_type: "birthday" | "percentage" | "fixed_amount" | "free_ticket" | "resident" | "group"; value: number; valid_from: string; valid_until: string; max_uses: string; active: boolean }
  setDiscountForm: React.Dispatch<React.SetStateAction<{ id: string; code: string; name: string; game_id: string; price_rule_id: string; min_players: string; max_players: string; day_scope: import("../../lib/staff/types").StaffDiscountDayScope; time_start: string; time_end: string; ticket_type: import("../../lib/staff/types").StaffDiscountTicketType; min_order_total: number; max_discount_amount: string; per_customer_limit: string; discount_type: "birthday" | "percentage" | "fixed_amount" | "free_ticket" | "resident" | "group"; value: number; valid_from: string; valid_until: string; max_uses: string; active: boolean }>>
  prices: import("../../lib/staff/types").StaffPriceRule[]
  updateDiscountType: (nextType: "birthday" | "percentage" | "fixed_amount" | "free_ticket" | "resident" | "group") => void
  selectedDiscountValueUnit: import("../../lib/staff/types").StaffDiscountValueUnit
  updateDiscountValue: (value: string) => void
  updateDiscountValueUnit: (unit: import("../../lib/staff/types").StaffDiscountValueUnit) => void
  discountHasHourLimit: boolean
  saveDiscount: () => Promise<void>
  openCommerceTab: (tab: import("../../lib/staff/types").StaffCommerceTab) => void
  loyaltyRules: import("../../lib/staff/types").StaffLoyaltyRule[]
  editLoyaltyRule: (rule: import("../../lib/staff/types").StaffLoyaltyRule) => void
  voucherRules: import("../../lib/staff/types").StaffDiscount[]
  discountRules: import("../../lib/staff/types").StaffDiscount[]
  editDiscount: (discount: import("../../lib/staff/types").StaffDiscount) => void
  gameNameById: Map<string, string>
  priceRuleNameById: Map<string, string>
}

export default function DiscountsSection({
  canEditCommerceTab,
  text,
  commerceTab,
  loyaltyForm,
  setLoyaltyForm,
  games,
  saving,
  saveLoyaltyRule,
  discountForm,
  setDiscountForm,
  prices,
  updateDiscountType,
  selectedDiscountValueUnit,
  updateDiscountValue,
  updateDiscountValueUnit,
  discountHasHourLimit,
  saveDiscount,
  openCommerceTab,
  loyaltyRules,
  editLoyaltyRule,
  voucherRules,
  discountRules,
  editDiscount,
  gameNameById,
  priceRuleNameById,
}: DiscountsSectionProps) {
  return (
    <div className="staff-grid">
      <div className="staff-card">
        {!canEditCommerceTab && <p className="staff-readonly-note">{text.messages.readOnlyCommerce}</p>}
        {commerceTab === 'loyalty' ? (
          <>
            <h3>{loyaltyForm.id ? text.editLoyaltyRule : text.labels.createLoyaltyRule}</h3>
            <p className="muted">{text.messages.loyaltyIntro}</p>
            <fieldset className="staff-readonly-fieldset" disabled={!canEditCommerceTab}>
              <div className="form-grid compact-form-grid">
                <label>{text.labels.ruleName}<input value={loyaltyForm.rule_name} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rule_name: event.target.value })} /></label>
                <label>{text.labels.game}<select value={loyaltyForm.game_id} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, game_id: event.target.value })}><option value="">{text.allGames}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
                <label>{text.labels.calculation}<select value={loyaltyForm.calculation_type} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, calculation_type: event.target.value as StaffLoyaltyRule['calculation_type'] })}>{loyaltyCalculationTypes.map((type) => <option key={type} value={type}>{loyaltyCalculationLabel(type, text)}</option>)}</select></label>
                <label>{text.labels.pointsEarned}<input min={0} step="0.01" type="number" value={loyaltyForm.points_value} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, points_value: Number(event.target.value) })} /></label>
                <label>{text.labels.perVndSpent}<input disabled={loyaltyForm.calculation_type !== 'per_vnd_spent'} min={0} type="number" value={loyaltyForm.spend_amount} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, spend_amount: Number(event.target.value) })} /></label>
                <label>{text.labels.minimumSpend}<input min={0} type="number" value={loyaltyForm.min_order_total} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, min_order_total: Number(event.target.value) })} /></label>
                <label>{text.labels.redeemValue}<input min={0} type="number" value={loyaltyForm.redeem_value_vnd_per_point} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, redeem_value_vnd_per_point: Number(event.target.value) })} /></label>
                <label>{text.labels.pointsExpireAfterDays}<input min={1} type="number" value={loyaltyForm.point_expiry_days} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, point_expiry_days: event.target.value })} /></label>
                <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.loyaltyValidFrom} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_from} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_from: value })} /></label>
                <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.loyaltyValidUntil} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_until} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_until: value })} /></label>
                <label className="full">{text.labels.notes}<textarea value={loyaltyForm.notes} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, notes: event.target.value })} /></label>
                <label className="checkbox-row"><input type="checkbox" checked={loyaltyForm.active} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, active: event.target.checked })} /> {text.labels.active}</label>
              </div>
              <button className="primary" type="button" disabled={saving || !loyaltyForm.rule_name.trim()} onClick={saveLoyaltyRule}>
                <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveLoyaltyRule}</ButtonIconText>
              </button>
            </fieldset>
          </>
        ) : (
          <>
            <h3>
              {discountForm.id
                ? (commerceTab === 'vouchers' ? text.editVoucher : text.editDiscount)
                : (commerceTab === 'vouchers' ? text.labels.createVoucher : text.labels.createDiscount)}
            </h3>
            <p className="muted">{text.labels.discountRuleHelp}</p>
            <fieldset className="staff-readonly-fieldset" disabled={!canEditCommerceTab}>
              <div className="form-grid compact-form-grid">
                <label>{commerceTab === 'vouchers' ? text.labels.voucherCodeRequired : text.labels.codeOptional}<input value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} /></label>
                <label>{text.labels.name}<input value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} /></label>
                <label>{text.labels.game}<select value={discountForm.game_id} onChange={(event) => setDiscountForm({ ...discountForm, game_id: event.target.value })}><option value="">{text.allGames}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
                <label>{text.labels.priceRule}<select value={discountForm.price_rule_id} onChange={(event) => setDiscountForm({ ...discountForm, price_rule_id: event.target.value })}><option value="">{text.allPriceRules}</option>{prices.map((rule) => <option key={rule.id} value={rule.id}>{rule.rule_name}</option>)}</select></label>
                <label>{text.labels.type}<select value={discountForm.discount_type} onChange={(event) => updateDiscountType(event.target.value as StaffDiscount['discount_type'])}>{discountTypes.map((type) => <option key={type} value={type}>{text.discountTypes[type]}</option>)}</select></label>
                <label className="staff-discount-value-field">
                  <span className="staff-label-line">
                    <span>{text.labels.value}</span>
                    <small>{formatDiscountRuleValue(discountForm, text)}</small>
                  </span>
                  <span className="staff-discount-value-control">
                    <input
                      disabled={discountForm.discount_type === 'free_ticket'}
                      inputMode={selectedDiscountValueUnit === 'fixed_amount' ? 'numeric' : 'decimal'}
                      max={selectedDiscountValueUnit === 'percentage' ? 100 : undefined}
                      min={0}
                      placeholder={selectedDiscountValueUnit === 'fixed_amount' ? '0 đ' : '%'}
                      value={discountForm.discount_type === 'free_ticket'
                        ? text.discountTypes.free_ticket
                        : selectedDiscountValueUnit === 'fixed_amount'
                          ? formatDongInput(discountForm.value)
                          : formatPercentInput(discountForm.value)}
                      onChange={(event) => updateDiscountValue(event.target.value)}
                    />
                    <select
                      aria-label={text.aria.discountValueUnit}
                      disabled={discountForm.discount_type === 'free_ticket'}
                      value={selectedDiscountValueUnit}
                      onChange={(event) => updateDiscountValueUnit(event.target.value as StaffDiscountValueUnit)}
                    >
                      <option value="percentage">%</option>
                      <option value="fixed_amount">VND</option>
                    </select>
                  </span>
                </label>
                <div className="full staff-form-section-label">{text.labels.discountConditions}</div>
                <label>{text.labels.minPlayers}<input min={1} type="number" value={discountForm.min_players} onChange={(event) => setDiscountForm({ ...discountForm, min_players: event.target.value })} /></label>
                <label>{text.labels.maxPlayers}<input min={1} type="number" value={discountForm.max_players} onChange={(event) => setDiscountForm({ ...discountForm, max_players: event.target.value })} /></label>
                <label>{text.labels.dayType}<select value={discountForm.day_scope} onChange={(event) => setDiscountForm({ ...discountForm, day_scope: event.target.value as StaffDiscountDayScope })}>{staffDiscountDayScopes.map((scope) => <option key={scope} value={scope}>{text.discountDayScopes[scope]}</option>)}</select></label>
                <label>{text.labels.ticketType}<select value={discountForm.ticket_type} onChange={(event) => setDiscountForm({ ...discountForm, ticket_type: event.target.value as StaffDiscountTicketType })}>{staffDiscountTicketTypes.map((ticketType) => <option key={ticketType} value={ticketType}>{text.discountTicketTypes[ticketType]}</option>)}</select></label>
                <label className="checkbox-row full">
                  <input
                    checked={discountHasHourLimit}
                    type="checkbox"
                    onChange={(event) => setDiscountForm({
                      ...discountForm,
                      time_start: event.target.checked ? (discountForm.time_start || '09:00') : '',
                      time_end: event.target.checked ? (discountForm.time_end || '22:00') : '',
                    })}
                  />
                  {text.labels.limitByHour}
                </label>
                {discountHasHourLimit && (
                  <>
                    <label>{text.labels.start}<StaffPickerField ariaLabel={text.aria.discountStartTime} placeholder={text.chooseTime} type="time" value={discountForm.time_start} onChange={(value) => setDiscountForm({ ...discountForm, time_start: value })} /></label>
                    <label>{text.labels.end}<StaffPickerField ariaLabel={text.aria.discountEndTime} placeholder={text.chooseTime} type="time" value={discountForm.time_end} onChange={(value) => setDiscountForm({ ...discountForm, time_end: value })} /></label>
                  </>
                )}
                <label>{text.labels.minimumSpend}<input min={0} type="number" value={discountForm.min_order_total} onChange={(event) => setDiscountForm({ ...discountForm, min_order_total: Number(event.target.value) || 0 })} /></label>
                <label>{text.labels.maxDiscountAmount}<input min={0} type="number" value={discountForm.max_discount_amount} onChange={(event) => setDiscountForm({ ...discountForm, max_discount_amount: event.target.value })} /></label>
                <label>{text.labels.perCustomerLimit}<input min={1} type="number" value={discountForm.per_customer_limit} onChange={(event) => setDiscountForm({ ...discountForm, per_customer_limit: event.target.value })} /></label>
                <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.discountValidFrom} placeholder={text.chooseDate} type="date" value={discountForm.valid_from} onChange={(value) => setDiscountForm({ ...discountForm, valid_from: value })} /></label>
                <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.discountValidUntil} placeholder={text.chooseDate} type="date" value={discountForm.valid_until} onChange={(value) => setDiscountForm({ ...discountForm, valid_until: value })} /></label>
                <label>{text.labels.maxUses}<input type="number" value={discountForm.max_uses} onChange={(event) => setDiscountForm({ ...discountForm, max_uses: event.target.value })} /></label>
                <label className="checkbox-row"><input type="checkbox" checked={discountForm.active} onChange={(event) => setDiscountForm({ ...discountForm, active: event.target.checked })} /> {text.labels.active}</label>
              </div>
              <button className="primary" type="button" disabled={saving || !discountForm.name.trim()} onClick={saveDiscount}>
                <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{commerceTab === 'vouchers' ? text.actions.saveVoucher : text.actions.saveDiscount}</ButtonIconText>
              </button>
            </fieldset>
          </>
        )}
      </div>
      <div className="staff-card">
        <div className="staff-commerce-switcher" role="tablist" aria-label={text.tabs.discounts}>
          {staffCommerceTabs.map((item) => (
            <button
              aria-selected={commerceTab === item}
              className={commerceTab === item ? 'active' : ''}
              key={item}
              role="tab"
              type="button"
              onClick={() => openCommerceTab(item)}
            >
              {text.commerceTabs[item]}
            </button>
          ))}
        </div>

        {commerceTab === 'loyalty' ? (
          <>
            <h3>{text.commerceTabs.loyalty}</h3>
            {loyaltyRules.map((rule) => (
              <button className="staff-list-item" key={rule.id} type="button" onClick={() => editLoyaltyRule(rule)}>
                <strong>{rule.rule_name}</strong>
                <span>
                  {loyaltyCalculationLabel(rule.calculation_type, text)}
                  {' · '}
                  {rule.points_value} pts
                  {rule.calculation_type === 'per_vnd_spent' ? ` / ${formatVnd(rule.spend_amount)}` : ''}
                  {' · '}
                  {text.labels.redeemValue} {formatVnd(rule.redeem_value_vnd_per_point ?? 0)}
                  {' · '}
                  {rule.point_expiry_days ? `${rule.point_expiry_days} ${text.days}` : text.noExpiry}
                  {' · '}
                  {rule.active ? text.active : text.inactive}
                </span>
              </button>
            ))}
            {loyaltyRules.length === 0 && <p className="notice">{text.messages.noLoyaltyRules}</p>}
          </>
        ) : (
          <>
            <h3>{commerceTab === 'vouchers' ? text.labels.vouchers : text.labels.discounts}</h3>
            {(commerceTab === 'vouchers' ? voucherRules : discountRules).map((discount) => (
              <button className="staff-list-item" key={discount.id} type="button" onClick={() => editDiscount(discount)}>
                <strong>{discount.code ? `${discount.code} · ${discount.name}` : discount.name}</strong>
                <span>{text.discountTypes[discount.discount_type]} · {formatDiscountRuleValue(discount, text)} · {formatDiscountRuleConditions(discount, discount.game_id ? gameNameById.get(discount.game_id) || text.gameFallback : text.allGames, discount.price_rule_id ? priceRuleNameById.get(discount.price_rule_id) || text.labels.priceRule : text.allPriceRules, text)} · {text.labels.used} {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ''}</span>
              </button>
            ))}
            {commerceTab === 'vouchers' && voucherRules.length === 0 && <p className="notice">{text.messages.noVouchers}</p>}
            {commerceTab === 'discounts' && discountRules.length === 0 && <p className="notice">{text.messages.noDiscounts}</p>}
          </>
        )}
      </div>
    </div>
  )
}
