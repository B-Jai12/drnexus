"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Search, SortAsc, SortDesc, Filter, Download,
  ChevronLeft, ChevronRight, X, Loader2, AlertTriangle, Repeat,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CategoryBadge } from "@/components/dashboard/category-badge"
import type { TransactionCategory } from "@/types"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { getTransactions } from "@/src/services/transactionService"
import { useAppStore } from "@/lib/store"

interface RealTransaction {
  id: number | string
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

const PAGE_SIZE = 12

export default function TransactionsPage() {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [apiTransactions, setApiTransactions] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedFlag, setSelectedFlag] = useState<string>("all") // all | anomaly | recurring
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await getTransactions({
          search,
          category: selectedCategory,
          type: selectedType,
          sortOrder,
          page,
          pageSize: PAGE_SIZE,
          flag: selectedFlag as "all" | "anomaly" | "recurring",
        })
        setApiTransactions(res.data || [])
        setTotalCount(res.total || 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transactions.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [search, selectedCategory, selectedType, selectedFlag, sortOrder, page, dataVersion])

  const allTransactions = useMemo(() => {
    return apiTransactions.map((t) => ({
      id: String(t.id),
      date: t.date,
      merchant: t.merchant || t.description?.substring(0, 40) || "Unknown",
      description: t.description || "",
      category: t.category || "Uncategorized",
      confidence: t.confidence ?? 0,
      type: String(t.type).toUpperCase() === "CREDIT" ? "credit" : "debit",
      amount: Number(t.amount || 0),
      is_anomaly: t.is_anomaly ?? false,
      anomaly_severity: t.anomaly_severity ?? "normal",
      z_score: t.z_score ?? 0,
      is_recurring: t.is_recurring ?? false,
    }))
  }, [apiTransactions])

  const categories = useMemo(() => {
    const cats = new Set(allTransactions.map(t => t.category))
    return Array.from(cats) as TransactionCategory[]
  }, [allTransactions])

  const filtered = useMemo(() => allTransactions, [allTransactions])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const paginatedData = filtered

  const handleExport = useCallback(() => {
    const rows = [
      ["Date", "Merchant", "Category", "Type", "Amount", "Confidence", "Anomaly", "Recurring"],
      ...filtered.map(t => [t.date, t.merchant, t.category, t.type, t.amount,
        t.confidence ? `${Math.round(t.confidence * 100)}%` : "",
        t.is_anomaly ? "Yes" : "No",
        t.is_recurring ? "Yes" : "No"])
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "transactions.csv"; a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported!", { description: `${filtered.length} transactions exported.` })
  }, [filtered])

  const resetFilters = () => {
    setSearch(""); setSelectedCategory("all"); setSelectedType("all")
    setSelectedFlag("all"); setSortOrder("desc"); setPage(1)
  }

  const hasFilters = search || selectedCategory !== "all" || selectedType !== "all" || selectedFlag !== "all"

  const anomalyCount = allTransactions.filter(t => t.is_anomaly).length
  const recurringCount = allTransactions.filter(t => t.is_recurring).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
              <p className="text-muted-foreground mt-1">
                {totalCount} transactions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-transparent hidden sm:flex" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              <Button
                variant={filterOpen ? "default" : "outline"} size="sm"
                className={filterOpen ? "" : "bg-transparent"}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter className="w-4 h-4 mr-2" /> Filters
                {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
              </Button>
            </div>
          </div>

          {/* ML Summary Pills */}
          {(anomalyCount > 0 || recurringCount > 0) && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {anomalyCount > 0 && (
                <button
                  onClick={() => { setSelectedFlag(selectedFlag === "anomaly" ? "all" : "anomaly"); setPage(1) }}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedFlag === "anomaly"
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : "bg-red-500/5 text-red-400 border-red-500/15 hover:border-red-500/30"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {anomalyCount} anomalies
                </button>
              )}
              {recurringCount > 0 && (
                <button
                  onClick={() => { setSelectedFlag(selectedFlag === "recurring" ? "all" : "recurring"); setPage(1) }}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedFlag === "recurring"
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-blue-500/5 text-blue-400 border-blue-500/15 hover:border-blue-500/30"
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  {recurringCount} recurring
                </button>
              )}
              {selectedFlag !== "all" && (
                <button onClick={() => setSelectedFlag("all")} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Clear
                </button>
              )}
            </div>
          )}
        </StaggerItem>

        {/* Filters panel */}
        <AnimatePresence>
          {filterOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <StaggerItem>
                <div className="glass rounded-2xl p-5 space-y-4 gradient-border">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search merchant or description..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        className="pl-10 h-10 rounded-xl bg-background"
                      />
                    </div>
                    <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1) }}
                      className="h-10 rounded-xl border border-border bg-background text-foreground px-3 text-sm">
                      <option value="all">All Categories</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setPage(1) }}
                      className="h-10 rounded-xl border border-border bg-background text-foreground px-3 text-sm">
                      <option value="all">All Types</option>
                      <option value="debit">💸 Debit</option>
                      <option value="credit">💰 Credit</option>
                    </select>
                    <Button variant="outline" size="sm" className="bg-transparent h-10"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                      {sortOrder === "asc" ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                      {sortOrder === "asc" ? "Low → High" : "High → Low"}
                    </Button>
                  </div>
                  {hasFilters && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Active filters:</span>
                      {search && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          &quot;{search}&quot;<button onClick={() => setSearch("")}><X className="w-3 h-3" /></button>
                        </span>
                      )}
                      {selectedCategory !== "all" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {selectedCategory}<button onClick={() => setSelectedCategory("all")}><X className="w-3 h-3" /></button>
                        </span>
                      )}
                      {selectedType !== "all" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {selectedType}<button onClick={() => setSelectedType("all")}><X className="w-3 h-3" /></button>
                        </span>
                      )}
                      <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-2">
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              </StaggerItem>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <StaggerItem>
          {error && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              Failed to load transactions: {error}
            </div>
          )}
          <div className="glass-hover rounded-2xl overflow-hidden gradient-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-3.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left py-3.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Merchant</th>
                    <th className="text-left py-3.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Category</th>
                    <th className="text-left py-3.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Confidence</th>
                    <th className="text-right py-3.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-30" />
                          <p>No transactions found</p>
                          <button onClick={resetFilters} className="text-primary text-sm hover:underline">Clear all filters</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((txn, i) => (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.3 }}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors group ${
                          txn.is_anomaly ? "bg-red-500/[0.03] hover:bg-red-500/[0.06]" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{txn.date}</td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">
                            <span className="truncate max-w-[160px]">{txn.merchant}</span>
                            {txn.is_anomaly && (
                              <span title={`Anomaly · z=${txn.z_score}`}>
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              </span>
                            )}
                            {txn.is_recurring && (
                              <span title="Recurring">
                                <Repeat className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <CategoryBadge category={txn.category as any} />
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {txn.confidence > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    txn.confidence > 0.7 ? "bg-emerald-400" :
                                    txn.confidence > 0.4 ? "bg-yellow-400" : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.round(txn.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(txn.confidence * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                          txn.type === "credit" ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {txn.type === "credit" ? "+" : "-"}₹{txn.amount.toLocaleString()}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-8 h-8 bg-transparent" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2
                  if (pageNum < 1 || pageNum > totalPages) return null
                  return (
                    <Button key={pageNum} variant={pageNum === page ? "default" : "outline"} size="icon"
                      className={`w-8 h-8 text-xs ${pageNum === page ? "" : "bg-transparent"}`}
                      onClick={() => setPage(pageNum)}>
                      {pageNum}
                    </Button>
                  )
                })}
                <Button variant="outline" size="icon" className="w-8 h-8 bg-transparent"
                  disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}