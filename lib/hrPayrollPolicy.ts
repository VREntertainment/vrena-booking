export type ProgressivePitBracket = {
  up_to: number | null
  rate: number
}

type PayrollTaxBaseInput = {
  grossIncome: number
  mealAllowance: number
  overtimePay: number
  employeeContributions: number
  personalDeduction: number
  dependentDeduction: number
}

export function calculatePayrollTaxBases({
  grossIncome,
  mealAllowance,
  overtimePay,
  employeeContributions,
  personalDeduction,
  dependentDeduction,
}: PayrollTaxBaseInput) {
  const incomeAfterInsurance = Math.max(0, grossIncome - employeeContributions)
  return {
    shortTermWithholdingBase: Math.max(0, incomeAfterInsurance - overtimePay),
    progressiveTaxableIncome: Math.max(
      0,
      incomeAfterInsurance - mealAllowance - overtimePay - personalDeduction - dependentDeduction,
    ),
  }
}

export function calculateProgressivePit(taxableIncome: number, brackets: ProgressivePitBracket[]) {
  let previousCap = 0
  let remaining = Math.max(0, taxableIncome)
  let tax = 0

  for (const bracket of brackets) {
    if (remaining <= 0) break
    const rate = Math.max(0, Number(bracket.rate) || 0) / 100
    if (bracket.up_to == null) {
      tax += remaining * rate
      break
    }
    const cap = Math.max(previousCap, Number(bracket.up_to) || 0)
    const taxableInBracket = Math.min(remaining, cap - previousCap)
    tax += taxableInBracket * rate
    remaining -= taxableInBracket
    previousCap = cap
  }

  return Math.round(tax)
}

export function progressivePitExcelFormula(taxableIncomeCell: string, brackets: ProgressivePitBracket[]) {
  let previousCap = 0
  return brackets.map((bracket) => {
    const rate = Math.max(0, Number(bracket.rate) || 0)
    if (bracket.up_to == null) return `MAX(0,${taxableIncomeCell}-${previousCap})*${rate}%`
    const cap = Math.max(previousCap, Number(bracket.up_to) || 0)
    const term = `MAX(0,MIN(${taxableIncomeCell},${cap})-${previousCap})*${rate}%`
    previousCap = cap
    return term
  }).join('+') || '0'
}
