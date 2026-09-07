# Maintainability refactor — 7 September 2026

The September review identified large booking/staff controllers, a broad HR interface, and two oversized stylesheets. This release separates business rules from React orchestration and gives styles an explicit owner while preserving existing booking, payment, payroll, and access behavior.

## Where changes belong

| Responsibility | Owner |
| --- | --- |
| Arena availability, opening hours, and excluded sessions | `lib/booking/availability.ts` |
| Best-discount selection and loyalty arithmetic | `lib/booking/checkout.ts` |
| Voucher/loyalty state, requests, debounce, and stale-response cancellation | `hooks/useTicketCheckout.ts` |
| Tournament bracket rules and tournament commands | `lib/booking/tournamentRules.ts`, `lib/booking/tournamentActions.ts` |
| Pending booking handoff and lazy client loading | `lib/booking/pendingAccountBooking.ts`, `lib/booking/client.ts` |
| Staff pricing, payments, and operation labels/change records | `lib/staff/pricing.ts`, `payments.ts`, `operations.ts` |
| Payroll calculations, scheduling, and HR settings/forms | `lib/staff/payroll.ts`, `scheduling.ts`, `hrSettings.ts` |
| Report aggregation and export presentation | `lib/staff/reporting.ts`, `reportExports.ts` |
| Staff catalog, profile, form, and formatting helpers | Named modules in `lib/staff/` |
| Shared staff date/time picker, player search, and avatar | `components/staff/` |
| HR view state and commands | `lib/staff/hrModel.ts` |
| Booking/staff styling | Named files in `styles/booking/` and `styles/staff/` |

Import domain functions directly. Pure rules receive data and return values; they must not import React screens, hooks, or a live database client. Effects and authenticated mutations belong in hooks or named command/adaptor modules. Keep server authorization and the database authoritative; client-side calculations and visibility checks do not grant permissions.

The HR interface now carries state and commands instead of passing static helpers and constants through the staff controller. Unused fields and the obsolete HR filter computation were removed. Form types derive from the factories that own their defaults, avoiding a second handwritten schema.

## Styles and responsive behavior

`app/globals.css` and `app/staff/staff.css` are ordered import entry points. The extracted styles retain the original selectors, declarations, media queries, and cascade order. No breakpoint or visual token changed. Keep each feature's responsive rules with its existing section; shared responsive and late refinement sections remain explicitly named because their position affects the cascade.

A source comparison confirmed that the split preserves every rule and its order; only separating whitespace at file boundaries changes. This is an ownership change, not a claim of reduced CSS download size. The source-based theme checker now follows those imports so fixture checks continue to exercise the full stylesheet.

## Regression protection

`npm run check` includes architecture checks alongside lint, TypeScript, palette validation, and unit tests. Architecture checks reject runtime cycles between domain modules, untyped `any` in those modules, screen/hook dependencies inside business rules, new rules in the stylesheet entry points, and growth beyond the documented module size ceilings in `scripts/check-module-boundaries.mjs`.

Behavior tests cover arena occupancy and adjacent slots, venue differences and closing hours, non-stacking discounts, loyalty caps, approved paid hours versus clock spans, overtime categories, leave overlap, probation pay, shift conflicts, pricing precedence, bilingual payment exports, and tournament permission/lock checks. The existing isolated database and browser suite remains the release gate for the assembled application.

## Remaining structure

This implements the review's gradual extraction recommendation. The booking and staff components still coordinate substantial UI state and rendering. Continue moving a feature's state and commands together when that feature changes; do not move the remaining controller into one equally large hook or replace explicit types with a generic model. The size ceilings are transitional safeguards, not an assertion that file length alone measures maintainability.

This refactor requires no new service, paid plan, dependency, or production database migration.
