"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { MonthlyExpense } from "@/types"

interface ExpenseBarChartProps {
  data: MonthlyExpense[]
}

export function ExpenseBarChart({ data }: ExpenseBarChartProps) {
  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-1">Monthly Overview</h3>
      <p className="text-sm text-muted-foreground mb-6">Income vs Expenses over the last 6 months</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, undefined]}
            />
            <Legend />
            <Bar dataKey="credit" name="Income" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="debit" name="Expenses" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
