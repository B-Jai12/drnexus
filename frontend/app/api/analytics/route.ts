import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txRes = await query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC",
      ["demo-user"]
    );
    const rows = txRes.rows;

    const byCategory: Record<string, number> = {};
    const byMerchant: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    let totalDebit = 0;

    for (const t of rows) {
      if (t.type !== "debit") continue;
      const amt = Number(t.amount);
      totalDebit += amt;
      byCategory[t.category] = (byCategory[t.category] || 0) + amt;
      byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + amt;
      const d = new Date(t.date);
      const ym = !isNaN(d.getTime()) ? d.toISOString().slice(0, 7) : "2024-03";
      byMonth[ym] = (byMonth[ym] || 0) + amt;
    }

    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
        percentage: totalDebit > 0 ? Math.round((amount / totalDebit) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topMerchants = Object.entries(byMerchant)
      .map(([merchant, amount]) => ({ merchant, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const weeklyTrends = Object.entries(byMonth).map(([week, amount]) => ({
      week,
      amount: Number(amount.toFixed(2)),
    }));

    return NextResponse.json({
      categoryBreakdown,
      topMerchants,
      weeklyTrends,
      subscriptions: [],
      heatmap: [],
      trend: "stable",
      weekOverWeekChange: 0,
    });
  } catch (err: any) {
    return NextResponse.json({ categoryBreakdown: [], topMerchants: [], weeklyTrends: [] });
  }
}
