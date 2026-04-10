"use client"

import { useEffect, useState } from "react"
import {
  Heart, ArrowDownLeft, ArrowUpRight, PiggyBank, ExternalLink,
  Loader2, TrendingUp, TrendingDown, AlertTriangle, Upload,
  Repeat, Zap, BarChart2, RefreshCw, Brain,
} from "lucide-react"
import Link from "next/link"
import { StatCard } from "@/components/dashboard/stat-card"
import { ExpenseBarChart } from "@/components/charts/expense-bar-chart"
import { CategoryPieChart } from "@/components/charts/category-pie-chart"
import { CategoryBadge } from "@/components/dashboard/category-badge"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { motion, AnimatePresence } from "framer-motion"
import { getDashboardOverview } from "@/src/services/dashboardService"
import { useAppStore } from "@/lib/store"

interface Transaction {
  id: number
  date: string
  merchant: string
  description: string
  category: string
  confidence: number
  type: string
  amount: number
  month: string
  is_anomaly: boolean
  anomaly_severity: string
  z_score: number
  is_recurring: boolean
}

interface PythonAnalysis {
  summary: {
    health_score: number
    total_debit: number
    total_credit: number
    net_savings: number
    transaction_count: number
  }
  categories: Record<string, number>
  transactions: Transaction[]
  category_breakdown: Array<{ category: string; amount: number; percentage: number }>
  monthly_overview: Array<{ month: string; income: number; expenses: number }>
  forecast: {
    predicted_expense: number
    predicted_income: number
    predicted_savings: number
    confidence: string
    trend: string
    r2_score: number
  }
  anomalies: Array<{ merchant: string; amount: number; date: string; severity: string; z_score: number }>
  recurring_merchants: string[]
  ml_info: Record<string, string>
}

function HealthGauge({ score }: { score: number }) {
  const safeScore = isNaN(score) || score == null ? 0 : score
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (safeScore / 100) * circumference
  const color = safeScore >= 75 ? "#10B981" : safeScore >= 50 ? "#F59E0B" : "#EF4444"
  const label = safeScore >= 75 ? "Excellent" : safeScore >= 50 ? "Good" : "Needs Work"

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="text-3xl font-bold text-foreground"
          >
            {safeScore}
          </motion.span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Financial Health</p>
        <p className="text-xs mt-0.5 font-medium" style={{ color }}>{label}</p>
      </div>
      <div className="w-full space-y-2 mt-1">
        {[
          { label: "Savings Rate", value: Math.min(100, Math.max(0, safeScore)) },
          { label: "Spend Control", value: Math.min(100, Math.max(0, safeScore - 10)) },
          { label: "Consistency", value: Math.min(100, Math.max(0, safeScore + 5)) },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>{item.label}</span>
              <span>{item.value}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 1, delay: 1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightPill({ type, text }: { type: "good" | "warn" | "bad"; text: string }) {
  const styles = {
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    bad: "bg-red-500/10 text-red-400 border-red-500/20",
  }
  const icons = {
    good: <TrendingUp className="w-3 h-3" />,
    warn: <AlertTriangle className="w-3 h-3" />,
    bad: <AlertTriangle className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${styles[type]}`}>
      {icons[type]} {text}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "high") return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
      HIGH
    </span>
  )
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-medium">
      MEDIUM
    </span>
  )
}

export default function OverviewPage() {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [analysisData, setAnalysisData] = useState<PythonAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllAnomalies, setShowAllAnomalies] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getDashboardOverview()
        setAnalysisData(data as unknown as PythonAnalysis)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [dataVersion])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5 text-sm text-red-300">
        Failed to load overview: {error}
      </div>
    )
  }

  if (!analysisData) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
        No dashboard data available yet.
      </div>
    )
  }

  const healthScore = analysisData.summary.health_score
  const totalDebit = analysisData.summary.total_debit
  const totalCredit = analysisData.summary.total_credit
  const netSavings = analysisData.summary.net_savings

  const chartColors = ["#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#14b8a6"]
  const pieChartData = analysisData?.categories && Object.keys(analysisData.categories).length > 0
    ? Object.entries(analysisData.categories).map(([categoryName, amount], i) => {
        const total = Object.values(analysisData.categories).reduce((a, b) => a + b, 0)
        return {
          category: categoryName as any,
          amount: amount as number,
          percentage: total > 0 ? Math.round((amount as number / total) * 100) : 0,
          color: chartColors[i % chartColors.length]
        }
      })
    : []

  const barChartData = analysisData?.monthly_overview?.length
    ? analysisData.monthly_overview.map(m => ({ month: m.month, debit: m.expenses, credit: m.income }))
    : []

  const recentTransactions = analysisData?.transactions?.length
    ? analysisData.transactions.slice(0, 8).map(txn => ({
        id: `txn-${txn.id}`,
        date: txn.date,
        merchant: txn.merchant || txn.description?.substring(0, 40) || "Unknown",
        category: txn.category || "Personal & UPI",
        type: txn.type,
        amount: txn.amount,
        confidence: txn.confidence,
        is_anomaly: txn.is_anomaly,
        is_recurring: txn.is_recurring,
      }))
    : []

  const insights: { type: "good" | "warn" | "bad"; text: string }[] = []
  if (analysisData) {
    const savingsRate = totalCredit > 0 ? (netSavings / totalCredit) * 100 : 0
    if (savingsRate > 20) insights.push({ type: "good", text: `Saving ${Math.round(savingsRate)}% of income` })
    else if (savingsRate > 0) insights.push({ type: "warn", text: `Only saving ${Math.round(savingsRate)}% — aim for 20%` })
    else insights.push({ type: "bad", text: "Spending more than earning!" })

    const topCat = Object.entries(analysisData.categories || {}).sort(([, a], [, b]) => b - a)[0]
    if (topCat) {
      const pct = Math.round((topCat[1] / totalDebit) * 100)
      if (pct > 40) insights.push({ type: "warn", text: `${topCat[0]} is ${pct}% of spend` })
      else insights.push({ type: "good", text: "Spending well spread across categories" })
    }

    if (analysisData.anomalies?.length > 0)
      insights.push({ type: "warn", text: `${analysisData.anomalies.length} unusual transactions detected` })
    if (analysisData.recurring_merchants?.length > 0)
      insights.push({ type: "good", text: `${analysisData.recurring_merchants.length} subscriptions tracked` })
    if (analysisData.forecast?.trend === "increasing")
      insights.push({ type: "bad", text: "Spending trend is rising ↑" })
    else if (analysisData.forecast?.trend === "decreasing")
      insights.push({ type: "good", text: "Spending trend is falling ↓" })
  }

  const visibleAnomalies = showAllAnomalies
    ? (analysisData?.anomalies ?? [])
    : (analysisData?.anomalies ?? []).slice(0, 4)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <StaggerContainer>
        {/* Header */}
        <StaggerItem>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Financial Overview</h1>
              <p className="text-muted-foreground mt-1">
                {analysisData
                  ? `AI analysis · ${analysisData.summary.transaction_count} transactions`
                  : "Your financial health at a glance"}
              </p>
              {insights.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {insights.map((ins, i) => <InsightPill key={i} type={ins.type} text={ins.text} />)}
                </div>
              )}
            </div>
            <Link href="/dashboard/upload">
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
              >
                <Upload className="w-4 h-4" /> Upload Statement
              </motion.div>
            </Link>
          </div>
        </StaggerItem>

        {/* KPI Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Health Score" value={healthScore} suffix="/100" icon={Heart}
              gradient="from-emerald-500/20 to-teal-500/10" delay={0} />
            <StatCard title="Total Debit" value={totalDebit} prefix="₹" icon={ArrowDownLeft}
              gradient="from-red-500/20 to-red-500/5" delay={0.1} />
            <StatCard title="Total Credit" value={totalCredit} prefix="₹" icon={ArrowUpRight}
              gradient="from-blue-500/20 to-blue-500/5" delay={0.2} />
            <StatCard title="Net Savings" value={netSavings} prefix="₹" icon={PiggyBank}
              gradient="from-purple-500/20 to-purple-500/5" delay={0.3} />
          </div>
        </StaggerItem>

        {/* Health + Charts */}
        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="glass-hover rounded-2xl p-6 gradient-border"
            >
              <HealthGauge score={healthScore} />
            </motion.div>
            <div className="lg:col-span-2"><ExpenseBarChart data={barChartData} /></div>
            <div><CategoryPieChart data={pieChartData} /></div>
          </div>
        </StaggerItem>

        {/* Quick Stats */}
        {analysisData && (
          <StaggerItem>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Avg Transaction", value: `₹${Math.round(totalDebit / (analysisData.summary.transaction_count || 1)).toLocaleString()}`, sub: "per debit" },
                { label: "Largest Category", value: Object.entries(analysisData.categories || {}).sort(([, a], [, b]) => b - a)[0]?.[0] || "—", sub: `₹${Math.round(Object.entries(analysisData.categories || {}).sort(([, a], [, b]) => b - a)[0]?.[1] || 0).toLocaleString()}` },
                { label: "Savings Rate", value: `${totalCredit > 0 ? Math.round((netSavings / totalCredit) * 100) : 0}%`, sub: "of income saved" },
                { label: "Total Transactions", value: analysisData.summary.transaction_count, sub: "this period" },
              ].map((item, i) => (
                <motion.div key={item.label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="glass-hover rounded-xl p-4 gradient-border"
                >
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-foreground truncate">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                </motion.div>
              ))}
            </div>
          </StaggerItem>
        )}

        {/* ── ML SECTION: Forecast ─────────────────────────────────────── */}
        {analysisData?.forecast && analysisData.forecast.predicted_expense > 0 && (
          <StaggerItem>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-hover rounded-2xl p-6 gradient-border"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Next Month Forecast</h3>
                  <p className="text-xs text-muted-foreground">Linear Regression · R² = {analysisData.forecast.r2_score}</p>
                </div>
                <div className="ml-auto">
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    analysisData.forecast.confidence === "high"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : analysisData.forecast.confidence === "medium"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : "bg-muted/30 text-muted-foreground border-border"
                  }`}>
                    {analysisData.forecast.confidence} confidence
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Predicted Expenses",
                    value: `₹${Math.round(analysisData.forecast.predicted_expense).toLocaleString()}`,
                    icon: <ArrowDownLeft className="w-4 h-4" />,
                    color: "text-red-400",
                    bg: "bg-red-500/10",
                  },
                  {
                    label: "Predicted Income",
                    value: `₹${Math.round(analysisData.forecast.predicted_income).toLocaleString()}`,
                    icon: <ArrowUpRight className="w-4 h-4" />,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/10",
                  },
                  {
                    label: "Predicted Savings",
                    value: `₹${Math.round(analysisData.forecast.predicted_savings ?? 0).toLocaleString()}`,
                    icon: <PiggyBank className="w-4 h-4" />,
                    color: "text-blue-400",
                    bg: "bg-blue-500/10",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl bg-muted/10 border border-border/30">
                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center ${item.color}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                {analysisData.forecast.trend === "increasing"
                  ? <><TrendingUp className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Spending trend is increasing</span></>
                  : analysisData.forecast.trend === "decreasing"
                  ? <><TrendingDown className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Spending trend is decreasing</span></>
                  : <><RefreshCw className="w-3.5 h-3.5" /><span>Spending trend is stable</span></>
                }
              </div>
            </motion.div>
          </StaggerItem>
        )}

        {/* ── ML SECTION: Anomalies ────────────────────────────────────── */}
        {analysisData?.anomalies && analysisData.anomalies.length > 0 && (
          <StaggerItem>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-hover rounded-2xl p-6 gradient-border"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Anomalies Detected</h3>
                    <p className="text-xs text-muted-foreground">Z-Score + IQR analysis · {analysisData.anomalies.length} unusual transactions</p>
                  </div>
                </div>
                {analysisData.anomalies.length > 4 && (
                  <button
                    onClick={() => setShowAllAnomalies(!showAllAnomalies)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAllAnomalies ? "Show less" : `Show all ${analysisData.anomalies.length}`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {visibleAnomalies.map((anomaly, i) => (
                    <motion.div
                      key={`${anomaly.merchant}-${i}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-red-500/5 border border-red-500/15 hover:border-red-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{anomaly.merchant}</p>
                          <p className="text-[11px] text-muted-foreground">{anomaly.date} · z={anomaly.z_score}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <SeverityBadge severity={anomaly.severity} />
                        <span className="text-sm font-bold text-red-400">₹{anomaly.amount.toLocaleString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          </StaggerItem>
        )}

        {/* ── ML SECTION: Recurring / Subscriptions ───────────────────── */}
        {analysisData?.recurring_merchants && analysisData.recurring_merchants.length > 0 && (
          <StaggerItem>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-hover rounded-2xl p-6 gradient-border"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Repeat className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Recurring Transactions</h3>
                  <p className="text-xs text-muted-foreground">KMeans clustering · {analysisData.recurring_merchants.length} subscriptions detected</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisData.recurring_merchants.map((merchant, i) => {
                  const txns = analysisData.transactions.filter(t => t.merchant === merchant && t.type === "DEBIT")
                  const avgAmount = txns.length ? Math.round(txns.reduce((a, t) => a + t.amount, 0) / txns.length) : 0
                  return (
                    <motion.div
                      key={merchant}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/15 hover:border-blue-500/30 transition-colors"
                    >
                      <Repeat className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-foreground font-medium">{merchant}</span>
                      {avgAmount > 0 && (
                        <span className="text-xs text-blue-400 font-semibold">₹{avgAmount.toLocaleString()}/mo</span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </StaggerItem>
        )}

        {/* ── ML Info Banner ───────────────────────────────────────────── */}
        {analysisData?.ml_info && (
          <StaggerItem>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">ML Pipeline</span>
              </div>
              {Object.entries(analysisData.ml_info).map(([key, value]) => (
                <span key={key} className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/30 border border-border/30">
                  {value}
                </span>
              ))}
            </div>
          </StaggerItem>
        )}

        {/* Recent Transactions */}
        <StaggerItem>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="glass-hover rounded-2xl overflow-hidden gradient-border"
          >
            <div className="p-6 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Your latest financial activity</p>
              </div>
              <Link href="/dashboard/transactions"
                className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Merchant</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Category</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn, i) => (
                    <motion.tr
                      key={txn.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                      className={`border-b border-border/30 hover:bg-muted/20 transition-colors group ${txn.is_anomaly ? "bg-red-500/3" : ""}`}
                    >
                      <td className="py-3 px-4 text-muted-foreground text-xs">{txn.date}</td>
                      <td className="py-3 px-4 font-medium text-foreground group-hover:text-primary transition-colors">
                        <div className="flex items-center gap-1.5">
                          {txn.merchant}
                          {txn.is_anomaly && <span title="Anomaly detected"><AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" /></span>}
                          {txn.is_recurring && <span title="Recurring"><Repeat className="w-3 h-3 text-blue-400 flex-shrink-0" /></span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <CategoryBadge category={txn.category as any} />
                          {txn.confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(txn.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${txn.type === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
                        {txn.type === "CREDIT" ? "+" : "-"}₹{txn.amount.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}