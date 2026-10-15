/**
 * Troski's per-trip service fee. Ghana VAT Act 2025 (Act 1151): public passenger
 * transport is VAT-exempt, so the trotro fare carries no tax (it's the driver's
 * takings). Troski's platform service fee IS a taxable supply → 15% VAT + 2.5%
 * NHIL + 2.5% GETFund (≈20%). The fee is tax-INCLUSIVE, so the rider's total is
 * unchanged. Checkout shows one "Service fee (incl. VAT)" line; the receipt
 * shows the split (UX v2 C2).
 */
export const SERVICE_FEE_INCL = 0.25
export const SERVICE_TAX_RATE = 0.2

export function splitServiceFee(incl = SERVICE_FEE_INCL): { base: number; tax: number } {
  const base = incl / (1 + SERVICE_TAX_RATE)
  return { base, tax: incl - base }
}
