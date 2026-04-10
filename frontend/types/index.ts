export interface Transaction {
  id: string
  date: string
  merchant: string
  category: TransactionCategory
  amount: number
  type: "debit" | "credit"
  description: string
}

export type TransactionCategory =
  | "Food & Dining"
  | "Shopping"
  | "Transportation"
  | "Entertainment"
  | "Bills & Utilities"
  | "Healthcare"
  | "Education"
  | "Travel"
  | "Subscriptions"
  | "Income"

export interface FinancialSummary {
  totalDebit: number
  totalCredit: number
  netSavings: number
  healthScore: number
  monthlyExpenses: MonthlyExpense[]
  categoryBreakdown: CategoryBreakdown[]
}

export interface MonthlyExpense {
  month: string
  debit: number
  credit: number
}

export interface CategoryBreakdown {
  category: TransactionCategory
  amount: number
  percentage: number
  color: string
}

export interface Prediction {
  month: string
  predicted: number
  actual?: number
  confidence: number
}

export interface SmartAlternative {
  name: string
  type: "restaurant" | "app" | "store" | "service" | "transport" | "plan"
  reason: string
  estimatedSavings: number
  rating?: number
  discount?: string
  url?: string
}

export interface Recommendation {
  id: string
  title: string
  description: string
  savings: number
  priority: "high" | "medium" | "low"
  category: TransactionCategory
  icon: string
  currentSpending: number
  targetSpending: number
  aiInsight: string
  alternatives: SmartAlternative[]
}

export interface SpendingHeatmap {
  day: string
  hour: number
  amount: number
}

export interface MerchantSpending {
  merchant: string
  amount: number
  transactions: number
  category: TransactionCategory
}

export interface WeeklyTrend {
  week: string
  amount: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}
