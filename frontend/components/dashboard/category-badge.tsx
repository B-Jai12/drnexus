import { cn } from "@/lib/utils"
import type { TransactionCategory } from "@/types"

const categoryStyles: Record<TransactionCategory, string> = {
  "Food & Dining": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Shopping: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Transportation: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Entertainment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Bills & Utilities": "bg-red-500/10 text-red-400 border-red-500/20",
  Healthcare: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Education: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Travel: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Subscriptions: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Income: "bg-green-500/10 text-green-400 border-green-500/20",
}

export function CategoryBadge({ category }: { category: TransactionCategory }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        categoryStyles[category]
      )}
    >
      {category}
    </span>
  )
}
