"use client"

import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useMemo } from "react"
import { AlertTriangle, ChevronDown, Shield, TrendingUp, Loader2 } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { apiGet } from "@/src/services/api"
import { useAppStore } from "@/lib/store"

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
}

interface PredictionsApiResponse {
  forecast: Array<{ month: string; actual: number | null; predicted: number; confidence: number }>
  alerts: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; description: string; category: string; amount: number }>
  cards: Array<{ month: string; predicted: number; actual: number | null; confidence: number }>
  overall_confidence: number
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (confidence / 100) * circumference
  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
        <motion.circle
          cx="50" cy="50" r="40" fill="none"
          stroke="hsl(var(--chart-1))"
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">{confidence}%</span>
        <span className="text-[9px] text-muted-foreground">confidence</span>
      </div>
    </div>
  )
}

export default function PredictionsPage() {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [apiData, setApiData] = useState<PredictionsApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)

      // 1. Try localStorage first — build predictions from saved ML result
      try {
        const cached = typeof window !== "undefined"
          ? localStorage.getItem("drnexus_latest_analysis")
          : null
        if (cached) {
          const parsed = JSON.parse(cached)
          const data = parsed?.ml ?? parsed
          const monthly: Array<{ month: string; income: number; expenses: number }> =
            Array.isArray(data?.monthly_overview) ? data.monthly_overview : []
          const forecast_ml = data?.forecast ?? {}
          const transactions: any[] = Array.isArray(data?.transactions) ? data.transactions : []
          const categories: Record<string, number> = data?.categories ?? {}
          const total_debit: number = data?.summary?.total_debit ?? 0

          if (monthly.length > 0 || Object.keys(forecast_ml).length > 0) {
            // Build forecast chart: real months as actual + 1 predicted month
            const forecastRows = monthly.map((m) => ({
              month: m.month,
              actual: m.expenses,
              predicted: null as number | null,
              confidence: 70,
            }))
            const predicted = forecast_ml.predicted_expense ?? 0
            if (predicted > 0) {
              forecastRows.push({
                month: "Next Month",
                actual: null,
                predicted,
                confidence: Math.round((forecast_ml.r2_score ?? 0.5) * 100),
              })
            }

            // Build risk alerts from anomalies + category overspend
            const alerts: PredictionsApiResponse["alerts"] = []
            const anomalies: any[] = data?.anomalies ?? []
            anomalies.slice(0, 3).forEach((a, i) => {
              alerts.push({
                id: `anomaly-${i}`,
                severity: a.severity === "high" ? "high" : "medium",
                title: `Unusual spend: ${a.merchant}`,
                description: `₹${Number(a.amount).toLocaleString()} was flagged as anomalous (z-score: ${a.z_score}).`,
                category: "Anomaly",
                amount: Number(a.amount),
              })
            })
            if (forecast_ml.trend === "increasing") {
              alerts.push({
                id: "trend-alert",
                severity: "medium",
                title: "Spending trend is rising",
                description: `Your spending is increasing. Next month predicted: ₹${Math.round(predicted).toLocaleString()}.`,
                category: "Forecast",
                amount: predicted,
              })
            }
            Object.entries(categories).forEach(([cat, amt]) => {
              if (cat !== "Income" && total_debit > 0 && amt / total_debit > 0.35) {
                alerts.push({
                  id: `overspend-${cat}`,
                  severity: "medium",
                  title: `High ${cat} spend`,
                  description: `${cat} is ${Math.round(amt / total_debit * 100)}% of total expenses (₹${Math.round(amt).toLocaleString()}).`,
                  category: cat,
                  amount: Math.round(amt),
                })
              }
            })

            // Build prediction cards: one per past month + next month
            const cards = monthly.slice(-3).map((m) => ({
              month: m.month,
              actual: m.expenses,
              predicted: m.expenses * 1.05, // slight overestimate as "baseline"
              confidence: 72,
            }))
            if (predicted > 0) {
              cards.push({
                month: "Next Month",
                actual: null as any,
                predicted,
                confidence: Math.round((forecast_ml.r2_score ?? 0.5) * 100),
              })
            }

            const overall_confidence = Math.round((forecast_ml.r2_score ?? 0.5) * 100)

            setApiData({ forecast: forecastRows as any, alerts, cards, overall_confidence })
            setIsLoading(false)
            return
          }
        }
      } catch { /* ignore */ }

      // 2. Fallback: backend API
      try {
        const data = await apiGet<PredictionsApiResponse>("/api/predictions")
        setApiData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load predictions.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [dataVersion])

  // ✅ Build forecast chart from real monthly_overview
  const forecastData = useMemo(() => {
    return apiData?.forecast || []
  }, [apiData])

  // ✅ Generate real risk alerts from category data
  const riskAlerts = useMemo(() => {
    return apiData?.alerts || []
  }, [apiData])

  // ✅ Generate prediction cards from real data
  const predictionCards = useMemo(() => {
    return apiData?.cards || []
  }, [apiData])

  const activeAlerts = riskAlerts.filter((a) => !dismissedAlerts.includes(a.id))

  // Confidence based on data quality
  const overallConfidence = apiData?.overall_confidence || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-red-300">Failed to load predictions: {error}</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <StaggerContainer>
        <StaggerItem>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Predictions</h1>
            <p className="text-muted-foreground mt-1">
              AI-powered spending forecasts and risk alerts
            </p>
          </div>
        </StaggerItem>

        {/* Forecast Chart */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border mt-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Spending Forecast</h3>
                <p className="text-sm text-muted-foreground">Actual vs predicted spending</p>
              </div>
              <ConfidenceGauge confidence={Math.round(overallConfidence)} />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => v != null ? [`₹${Number(v).toLocaleString()}`, undefined] : ["N/A", undefined]} />
                  <Legend />
                  <Area type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--chart-1))" fill="url(#actualGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--chart-1))", strokeWidth: 0 }} connectNulls={false} />
                  <Area type="monotone" dataKey="predicted" name="Predicted" stroke="hsl(var(--chart-2))" fill="url(#predictedGrad)" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4, fill: "hsl(var(--chart-2))", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </StaggerItem>

        {/* Risk Alerts */}
        <StaggerItem>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Risk Alerts
              {activeAlerts.length > 0 && (
                <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">{activeAlerts.length}</span>
              )}
            </h3>
            <AnimatePresence>
              {activeAlerts.map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className={`glass rounded-2xl p-5 flex items-start gap-4 border-l-4 ${
                    alert.severity === "high" ? "border-l-red-500" :
                    alert.severity === "medium" ? "border-l-yellow-500" : "border-l-blue-400"
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    alert.severity === "high" ? "text-red-500" :
                    alert.severity === "medium" ? "text-yellow-500" : "text-blue-400"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    {alert.amount > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        Amount: ₹{alert.amount.toLocaleString()} · {alert.category}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="sm" className="text-xs bg-transparent"
                    onClick={() => setDismissedAlerts([...dismissedAlerts, alert.id])}
                  >
                    Dismiss
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            {activeAlerts.length === 0 && (
              <div className="glass rounded-2xl p-8 text-center">
                <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">All clear! No active risk alerts.</p>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Prediction Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictionCards.map((pred, i) => {
              const trend = pred.actual != null && pred.actual > pred.predicted ? "over"
                : pred.actual != null && pred.actual < pred.predicted ? "under" : "pending"
              return (
                <motion.div
                  key={pred.month}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  onClick={() => setExpandedPrediction(expandedPrediction === pred.month ? null : pred.month)}
                  className="glass-hover rounded-2xl p-5 cursor-pointer gradient-border group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pred.month}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Spending forecast</p>
                    </div>
                    <motion.div animate={{ rotate: expandedPrediction === pred.month ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                  <p className="text-xl font-bold text-foreground">₹{pred.predicted.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pred.confidence}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{pred.confidence}%</span>
                  </div>
                  <AnimatePresence>
                    {expandedPrediction === pred.month && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground space-y-2">
                          <div className="flex justify-between">
                            <span>Status</span>
                            <span className={`font-medium ${trend === "over" ? "text-red-400" : trend === "under" ? "text-emerald-400" : "text-yellow-400"}`}>
                              {trend === "over" ? "↑ Over budget" : trend === "under" ? "↓ Under budget" : "→ Pending"}
                            </span>
                          </div>
                          {pred.actual != null && (
                            <div className="flex justify-between">
                              <span>Actual</span>
                              <span className="font-medium text-foreground">₹{pred.actual.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Risk Level</span>
                            <span className="font-medium">{pred.confidence >= 80 ? "Low" : pred.confidence >= 60 ? "Medium" : "High"}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}