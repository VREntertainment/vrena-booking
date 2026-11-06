# Payment value vouchers

Staff open Orders → Convert / redeem voucher. Any positive recorded receipt can
be partly or wholly converted, including completed orders. Historical fully-paid
orders with an unambiguous cash/card/bank method can materialize their original
receipt within the conversion transaction. Unpaid or ambiguous historical money
must be reconciled first. Already-refunded money cannot be converted.

Each conversion automatically issues an active, unique eight-character code
(uppercase A–Z without I/O, plus 2–9), with no expiry. The voucher is saved to the
order's linked customer profile and can be exported/shared as JPEG. The JPEG
shows original face value; current balance is always checked in the database.
The code is a bearer instrument: sharing it allows its recipient to use it.
Online checkout accepts it at its issuing venue, for VR, fixed-price birthday
packages, and Hà Đô SIM Racing. Unknown-price requests require staff pricing.

## Accounting and controls

- Keep the original positive receipt unchanged. Add a negative `voucher_conversion`
  entry linked one-to-one with issuance. Reduce source order total by the same
  amount, so the outstanding order balance is unchanged. This is a credit against
  the original order, not a cash refund or an automatic booking cancellation.
- Redemption debits the remaining voucher balance and writes a positive `voucher`
  payment on the destination order. Cash/bank reports retain the original cash
  movement; net settlement uses all signed entries. Redemption is not new cash.
- Row locks and stable request UUIDs protect conversion and redemption retries.
  Online reservation and redemption share one transaction; a failure rolls back
  both. Simultaneous redemption cannot overdraw the voucher.
- Staff role/MFA/PIN and venue checks remain enforced. Clients can only read their
  own vouchers; staff reads remain venue-scoped and require payment-management rank. Read-only staff cannot retrieve bearer codes. Direct ledger/balance edits are
  forbidden, and backing receipts cannot be changed or deleted.
- Cancellation alone does not refund money. Staff may convert a recorded voucher
  payment on a cancelled order back to new credit. Generic `refunded` status is
  blocked on voucher-linked orders to prevent an additional untracked cash refund.
- Issued invoices are retained and explicitly flagged for credit reconciliation in
  the source order note. This feature does not issue tax credit documents.

## Deployment

Apply `20261106124625_payment_value_vouchers.sql` and the subsequent `restrict_voucher_code_access` migration before deploying the app.
The migration is additive except for the receipt-method/sign constraints, which
continue to accept all historical payment methods. It does not rewrite existing
orders or receipts. Reverting the UI alone is safe; do not drop a live credit
ledger or restore the positive-only receipt constraint after vouchers are issued.

Live migration applied on 6 November 2026 as `20261106124625`. Verified RLS, denied direct balance writes, denied anonymous issuance, and zero created financial records after deployment.
