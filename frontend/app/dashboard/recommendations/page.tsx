"use client"

import { useEffect, useState, useMemo } from "react"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lightbulb, ChevronDown, ArrowRight, PiggyBank,
  Target, Zap, CheckCircle2, Brain,
  AlertCircle, TrendingUp, Wallet, ShoppingBag,
  Coffee, Car, Tv, RefreshCcw, Star, Trophy, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getRecommendations, type RecommendationsResponse } from "@/src/services/recommendationService"
import { getHealthScore } from "@/src/services/healthScoreService"
import { useAppStore } from "@/lib/store"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string; date: string; merchant: string
  description: string; category: string
  type: "DEBIT" | "CREDIT"; amount: number
}

interface AnalysisData {
  summary: {
    health_score: number; total_debit: number
    total_credit: number; net_savings: number; transaction_count: number
  }
  categories: Record<string, number>
  transactions: Transaction[]
  monthly_overview: { month: string; income: number; expenses: number }[]
  recommendations?: GeminiRecommendations   // ← from backend
}

// ─── Gemini recommendation shape (from backend) ───────────────────────────────
interface GeminiItem {
  id: string; title: string; description: string
  category: string; priority: "high" | "medium" | "low"
  potential_savings: number; action_label: string
}

interface GeminiRecommendations {
  summary: string
  items: GeminiItem[]
  total_potential_savings: number
  ai_generated: boolean
}

// ─── Fallback rule-based rec shape ───────────────────────────────────────────
interface Recommendation {
  id: string; title: string; description: string; detail: string
  category: string; priority: "high" | "medium" | "low"
  savings: number; icon: any; actionLabel: string
}

interface SavingsBreakdown {
  category: string; current: number; optimized: number; savings: number; icon: any
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const categoryIcons: Record<string, any> = {
  "Food & Dining": Coffee, "Shopping": ShoppingBag,
  "Transportation": Car, "Subscriptions": Tv,
  "Entertainment": Star, "Personal & UPI": Wallet,
  "Utilities": Zap, "Health": TrendingUp,
}

const geminiCategoryIcons: Record<string, any> = {
  spending: TrendingUp, investment: PiggyBank,
  subscription: Tv, budget: Target,
  savings: Wallet, insight: Brain,
}

function getCategoryIcon(cat: string) { return categoryIcons[cat] || Lightbulb }
function getGeminiIcon(cat: string)   { return geminiCategoryIcons[cat] || Lightbulb }

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":   return "bg-red-500/10 text-red-400 border-red-500/20"
    case "medium": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    default:       return "bg-blue-500/10 text-blue-400 border-blue-500/20"
  }
}

// ─── Rule-based recommendations (fallback if no Gemini data) ──────────────────
function generateRecommendations(data: AnalysisData): Recommendation[] {
  const recs: Recommendation[] = []
  const cats = data.categories || {}
  const total = data.summary.total_debit || 1
  const healthScore = data.summary.health_score

  if (cats["Food & Dining"] && cats["Food & Dining"] / total > 0.15) {
    const over = cats["Food & Dining"]
    recs.push({
      id: "food", title: "Cut Food Delivery Costs",
      description: `You're spending ₹${over.toLocaleString()} on food — ${Math.round((over / total) * 100)}% of total spend.`,
      detail: "Try cooking at home 3 more days a week and limit Zomato/Swiggy to weekends. Meal prepping on Sundays can save significant money.",
      category: "budget", priority: (over / total) > 0.25 ? "high" : "medium",
      savings: Math.round(over * 0.3), icon: Coffee, actionLabel: "Set Food Budget"
    })
  }
  if (cats["Subscriptions"] && cats["Subscriptions"] > 500) {
    const subSpend = cats["Subscriptions"]
    recs.push({
      id: "subs", title: "Audit Your Subscriptions",
      description: `₹${subSpend.toLocaleString()} going to subscriptions every month. Some may be unused.`,
      detail: "Switch streaming services to annual plans for 15-20% savings. Cancel services you haven't used in the last 2 weeks.",
      category: "savings", priority: subSpend > 1500 ? "high" : "medium",
      savings: Math.round(subSpend * 0.35), icon: Tv, actionLabel: "Review Subscriptions"
    })
  }
  if (cats["Shopping"] && cats["Shopping"] / total > 0.2) {
    const shopSpend = cats["Shopping"]
    recs.push({
      id: "shopping", title: "Reduce Impulse Shopping",
      description: `Shopping is ₹${shopSpend.toLocaleString()} (${Math.round((shopSpend / total) * 100)}% of expenses).`,
      detail: "Try a 48-hour rule before any online purchase above ₹500. Use wishlists to track items and buy only during sales.",
      category: "budget", priority: (shopSpend / total) > 0.3 ? "high" : "medium",
      savings: Math.round(shopSpend * 0.25), icon: ShoppingBag, actionLabel: "Set Shopping Limit"
    })
  }
  if (cats["Transportation"] && cats["Transportation"] > 2000) {
    const tSpend = cats["Transportation"]
    recs.push({
      id: "transport", title: "Optimise Travel Costs",
      description: `₹${tSpend.toLocaleString()} spent on transportation this period.`,
      detail: "Consider monthly metro/bus passes over daily Ola/Uber trips. Carpooling can halve your travel costs.",
      category: "savings", priority: "medium",
      savings: Math.round(tSpend * 0.25), icon: Car, actionLabel: "Track Travel"
    })
  }
  const savingsRate = data.summary.net_savings / (data.summary.total_credit || 1)
  if (savingsRate < 0.2 && data.summary.total_credit > 0) {
    recs.push({
      id: "savings-auto", title: "Automate Your Savings",
      description: `Your savings rate is ${Math.round(savingsRate * 100)}%. Aim for at least 20%.`,
      detail: `Set up an auto-transfer of ₹${Math.round(data.summary.total_credit * 0.1).toLocaleString()} to a savings/RD account on salary day.`,
      category: "investment", priority: savingsRate < 0 ? "high" : "medium",
      savings: Math.round(data.summary.total_credit * 0.1), icon: PiggyBank, actionLabel: "Set Auto-Save"
    })
  }
  if (healthScore < 50) {
    recs.push({
      id: "health-boost", title: "Improve Your Financial Health",
      description: `Your health score is ${healthScore}/100. Here's how to get above 70.`,
      detail: "Reduce your top spending category by 20%, build an emergency fund, and avoid spending more than you earn.",
      category: "investment", priority: "high",
      savings: Math.round(total * 0.1), icon: TrendingUp, actionLabel: "View Action Plan"
    })
  }
  const upiSpend = cats["Personal & UPI"] || 0
  if (upiSpend / total > 0.4) {
    recs.push({
      id: "upi", title: "Track UPI Transactions Better",
      description: `₹${upiSpend.toLocaleString()} in unclassified UPI payments (${Math.round((upiSpend / total) * 100)}%).`,
      detail: "Adding notes to UPI payments in PhonePe helps identify spending leakage.",
      category: "budget", priority: "medium",
      savings: Math.round(upiSpend * 0.1), icon: Wallet, actionLabel: "Categorise Spend"
    })
  }
  if (recs.length < 3) {
    recs.push({
      id: "invest", title: "Start a SIP Investment",
      description: "Invest even ₹500/month in an index fund to grow wealth long-term.",
      detail: "A monthly SIP of ₹1,000 in a Nifty 50 index fund at 12% returns becomes ₹2.3 lakhs in 10 years.",
      category: "investment", priority: "low",
      savings: 0, icon: TrendingUp, actionLabel: "Explore SIPs"
    })
  }
  return recs
}

function generateSavingsBreakdown(data: AnalysisData): SavingsBreakdown[] {
  const cats = data.categories || {}
  const reductionRates: Record<string, number> = {
    "Food & Dining": 0.3, "Shopping": 0.25, "Subscriptions": 0.35,
    "Transportation": 0.25, "Entertainment": 0.3, "Personal & UPI": 0.1, "Utilities": 0.05,
  }
  return Object.entries(cats).filter(([, amt]) => amt > 0)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([cat, current]) => {
      const rate = reductionRates[cat] ?? 0.1
      const savings = Math.round(current * rate)
      return { category: cat, current: Math.round(current), optimized: Math.round(current - savings), savings, icon: getCategoryIcon(cat) }
    })
}

function generateQuickActions(data: AnalysisData) {
  const cats = data.categories || {}
  const actions: any[] = []
  const credit = data.summary.total_credit
  if (cats["Food & Dining"]) actions.push({ icon: Coffee, label: "Limit food delivery to weekends", savings: `₹${Math.round(cats["Food & Dining"] * 0.3).toLocaleString()}/mo` })
  if (cats["Subscriptions"]) actions.push({ icon: Tv, label: "Switch to annual subscription plans", savings: `₹${Math.round(cats["Subscriptions"] * 0.2).toLocaleString()}/yr` })
  if (cats["Transportation"]) actions.push({ icon: Car, label: "Use public transit 3 days/week", savings: `₹${Math.round(cats["Transportation"] * 0.25).toLocaleString()}/mo` })
  if (credit > 0) actions.push({ icon: PiggyBank, label: `Auto-save ₹${Math.round(credit * 0.1).toLocaleString()} on payday`, savings: `₹${Math.round(credit * 0.1).toLocaleString()}/mo` })
  if (cats["Shopping"]) actions.push({ icon: ShoppingBag, label: "Apply 48hr rule before purchases > ₹500", savings: `₹${Math.round(cats["Shopping"] * 0.2).toLocaleString()}/mo` })
  if (actions.length < 3) {
    actions.push({ icon: Target, label: "Set a monthly spending budget per category", savings: "Varies" })
    actions.push({ icon: TrendingUp, label: "Start ₹500/month SIP in index fund", savings: "Long-term" })
  }
  return actions.slice(0, 4)
}

// ─── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const safe = isNaN(score) ? 0 : Math.max(0, Math.min(100, score))
  const radius = 40
  const circ = 2 * Math.PI * radius
  const dash = (safe / 100) * circ
  const color = safe >= 70 ? "#10b981" : safe >= 40 ? "#f59e0b" : "#ef4444"
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <motion.circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-xl font-bold" style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {safe}
        </motion.span>
        <span className="text-[9px] text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

// ─── Gemini Recommendations Section ──────────────────────────────────────────
function GeminiRecsSection({ recs, activeTab, setActiveTab }: {
  recs: GeminiRecommendations
  activeTab: "all" | "high" | "medium" | "low"
  setActiveTab: (t: "all" | "high" | "medium" | "low") => void
}) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [appliedRecs, setAppliedRecs] = useState<string[]>([])

  const filtered = activeTab === "all"
    ? recs.items
    : recs.items.filter(r => r.priority === activeTab)

  return (
    <div className="space-y-4">
      {/* AI badge + summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {recs.ai_generated && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[11px] text-primary font-semibold">Gemini AI Generated</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{recs.summary}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          Detailed Recommendations
        </h3>
        <div className="flex gap-1">
          {(["all", "high", "medium", "low"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-1 rounded-full border transition-all capitalize ${
                activeTab === tab
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-transparent text-muted-foreground border-border/40 hover:border-primary/20"
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((rec, i) => {
            const Icon = getGeminiIcon(rec.category)
            const isExpanded = expandedCard === rec.id
            const isApplied = appliedRecs.includes(rec.id)
            return (
              <motion.div key={rec.id} layout
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.06 }}
                onClick={() => !isApplied && setExpandedCard(isExpanded ? null : rec.id)}
                className={`glass-hover rounded-2xl p-5 gradient-border group transition-all ${isApplied ? "opacity-50 cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isApplied ? "bg-emerald-500/10" : "bg-primary/10"}`}>
                    {isApplied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Icon className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-sm font-semibold ${isApplied ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"}`}>
                        {rec.title}
                      </p>
                      {!isApplied && (
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{rec.description}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPriorityColor(rec.priority)}`}>
                        {rec.priority} priority
                      </span>
                      {rec.potential_savings > 0 && (
                        <span className="text-xs text-emerald-400 font-medium">
                          Save ₹{rec.potential_savings.toLocaleString()}/mo
                        </span>
                      )}
                      {isApplied && <span className="text-[10px] text-emerald-400 font-medium">✓ Applied</span>}
                    </div>
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && !isApplied && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAppliedRecs(prev => [...prev, rec.id])
                              setExpandedCard(null)
                              toast.success("Recommendation applied!", { description: rec.title })
                            }}>
                            {rec.action_label} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs bg-transparent"
                            onClick={(e) => { e.stopPropagation(); setExpandedCard(null) }}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-50" />
          <p className="text-sm">No {activeTab} priority recommendations!</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function RecommendationsPage() {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [apiRecommendations, setApiRecommendations] = useState<RecommendationsResponse | null>(null)
  const [healthScore, setHealthScore] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [appliedActions, setAppliedActions] = useState<number[]>([])
  const [appliedRecs, setAppliedRecs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "high" | "medium" | "low">("all")

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [recs, health] = await Promise.all([
          getRecommendations(),
          getHealthScore(),        // now reads from localStorage first — no timeout
        ])
        setApiRecommendations(recs)
        setHealthScore(health.health_score)

        // Also load analysisData from localStorage so quickActions/savingsBreakdown work
        try {
          const cached = typeof window !== "undefined"
            ? localStorage.getItem("drnexus_latest_analysis")
            : null
          if (cached) {
            const parsed = JSON.parse(cached)
            const data = parsed?.ml ?? parsed
            if (data?.transactions?.length > 0) setAnalysisData(data as AnalysisData)
          }
        } catch { /* ignore */ }

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recommendations.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [dataVersion])

  // Use Gemini recommendations if available, otherwise fall back to rule-based
  const geminiRecs = apiRecommendations
  const fallbackRecs = useMemo(() =>
    analysisData ? generateRecommendations(analysisData) : [], [analysisData])
  const savingsBreakdown = useMemo(() =>
    analysisData ? generateSavingsBreakdown(analysisData) : [], [analysisData])
  const quickActions = useMemo(() =>
    analysisData ? generateQuickActions(analysisData) : [], [analysisData])

  const totalPotentialSavings = geminiRecs
    ? geminiRecs.total_potential_savings
    : fallbackRecs.reduce((s, r) => s + r.savings, 0)

  const recCount = geminiRecs ? geminiRecs.items.length : 0
  const highCount = geminiRecs ? geminiRecs.items.filter(r => r.priority === "high").length : 0
  const medCount = geminiRecs ? geminiRecs.items.filter(r => r.priority === "medium").length : 0
  const lowCount = geminiRecs ? geminiRecs.items.filter(r => r.priority === "low").length : 0

  const maxCurrent = Math.max(...savingsBreakdown.map(s => s.current), 1)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading recommendations...</div>
  }

  return (
    // ✅ FIXED: pb-16 ensures content never gets clipped at bottom
    <div className="max-w-7xl mx-auto pb-16">
      <StaggerContainer className="space-y-6">

        {/* Header */}
        <StaggerItem>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                Recommendations
              </h1>
              <p className="text-muted-foreground mt-1">
                {geminiRecs
                  ? `${geminiRecs?.ai_generated ? "Gemini AI" : "AI"}-powered recommendation feed`
                  : "No recommendations available yet"}
              </p>
            </div>
            {geminiRecs && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Financial Health</p>
                  <p className="text-sm font-semibold text-foreground">{healthScore}/100</p>
                </div>
                <ScoreRing score={healthScore} />
              </div>
            )}
          </div>
        </StaggerItem>

        {/* No data banner */}
        {!geminiRecs && (
          <StaggerItem>
            <motion.div className="rounded-2xl p-5 border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">No recommendations available</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {error ? `API error: ${error}` : "No recommendation data returned from the API yet."}
                </p>
              </div>
            </motion.div>
          </StaggerItem>
        )}

        {/* Savings Summary Banner */}
        <StaggerItem>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-hover rounded-2xl p-6 gradient-border bg-gradient-to-r from-primary/5 to-chart-2/5">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-sm text-muted-foreground mb-1">Total Potential Monthly Savings</p>
                <p className="text-3xl font-bold gradient-text">
                  ₹{totalPotentialSavings > 0 ? totalPotentialSavings.toLocaleString() : "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {geminiRecs ? `Across ${recCount} actionable recommendations` : "Waiting for API data"}
                </p>
              </div>
              {geminiRecs && (
                <div className="flex gap-4">
                  <div className="bg-muted/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-muted-foreground">High</p>
                    <p className="text-lg font-bold text-red-400">{highCount}</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Medium</p>
                    <p className="text-lg font-bold text-yellow-400">{medCount}</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Low</p>
                    <p className="text-lg font-bold text-blue-400">{lowCount}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </StaggerItem>

        {/* Quick Actions */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Quick Actions
              {appliedActions.length > 0 && (
                <span className="ml-auto text-xs text-primary font-normal">{appliedActions.length} applied ✓</span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(quickActions.length > 0 ? quickActions : []).map((action, i) => {
                const isApplied = appliedActions.includes(i)
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      isApplied ? "bg-primary/5 border-primary/30" : "bg-muted/10 border-border/50 hover:border-primary/20 hover:bg-muted/20"
                    }`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isApplied ? "bg-primary/20" : "bg-muted/30"}`}>
                      {isApplied ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <action.icon className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isApplied ? "text-primary/80 line-through" : "text-foreground"}`}>{action.label}</p>
                      <p className="text-xs text-muted-foreground">Save {action.savings}</p>
                    </div>
                    {!isApplied && (
                      <Button variant="outline" size="sm" className="bg-transparent text-xs flex-shrink-0"
                        onClick={() => { setAppliedActions(prev => [...prev, i]); toast.success("Action marked!", { description: action.label }) }}>
                        Apply
                      </Button>
                    )}
                  </motion.div>
                )
              })}
            </div>
            {appliedActions.length > 0 && (
              <button onClick={() => setAppliedActions([])}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <RefreshCcw className="w-3 h-3" /> Reset actions
              </button>
            )}
          </div>
        </StaggerItem>

        {/* Savings Breakdown */}
        {savingsBreakdown.length > 0 && (
          <StaggerItem>
            <div className="glass-hover rounded-2xl p-6 gradient-border">
              <h3 className="text-lg font-semibold text-foreground mb-1">Savings Breakdown by Category</h3>
              <p className="text-sm text-muted-foreground mb-6">Current vs optimised spending</p>
              <div className="space-y-5">
                {savingsBreakdown.map((item, i) => (
                  <motion.div key={item.category}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <item.icon className="w-3.5 h-3.5 text-muted-foreground" />{item.category}
                      </span>
                      <span className="text-xs text-emerald-400 font-medium">Save ₹{item.savings.toLocaleString()}</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden">
                      <motion.div className="absolute h-full rounded-full bg-red-500/40"
                        initial={{ width: 0 }} animate={{ width: `${(item.current / maxCurrent) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }} />
                      <motion.div className="absolute h-full rounded-full bg-primary"
                        initial={{ width: 0 }} animate={{ width: `${(item.optimized / maxCurrent) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/40 inline-block" />Current: ₹{item.current.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Optimised: ₹{item.optimized.toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </StaggerItem>
        )}

        {/* ✅ Gemini AI recommendations (if available) else rule-based fallback */}
        <StaggerItem>
          {geminiRecs ? (
            <GeminiRecsSection recs={geminiRecs} activeTab={activeTab} setActiveTab={setActiveTab} />
          ) : (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Recommendations API returned no data.
            </div>
          )}
        </StaggerItem>

        {/* All applied celebration */}
        {appliedRecs.length > 0 && appliedRecs.length === fallbackRecs.length && !geminiRecs && (
          <StaggerItem>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-4">
              <Trophy className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400">All recommendations applied! 🎉</p>
                <p className="text-sm text-muted-foreground">You're on track to save ₹{totalPotentialSavings.toLocaleString()}/month. Keep it up!</p>
              </div>
            </motion.div>
          </StaggerItem>
        )}

      </StaggerContainer>
    </div>
  )
}