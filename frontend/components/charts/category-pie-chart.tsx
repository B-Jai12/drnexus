"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import type { CategoryBreakdown } from "@/types"

interface CategoryPieChartProps {
  data: CategoryBreakdown[]
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-1">Category Breakdown</h3>
      <p className="text-sm text-muted-foreground mb-6">Spending distribution by category</p>
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="h-52 w-52 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="amount"
                nameKey="category"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number) => [`₹${value.toLocaleString()}`, undefined]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2 w-full">
          {data.slice(0, 6).map((item) => (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground truncate">{item.category}</span>
              </div>
              <span className="font-medium text-foreground">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
