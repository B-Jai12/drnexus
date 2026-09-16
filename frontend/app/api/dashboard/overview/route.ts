import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = "demo-user";

    const insightRes = await query(
      "SELECT * FROM user_insights WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 1",
      [userId]
    );
    const insight = insightRes.rows[0];

    const txRes = await query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC",
      [userId]
    );
    const rows = txRes.rows;

    if (insight && insight.summary && Object.keys(insight.summary).length > 0) {
      return NextResponse.json({
        summary: insight.summary,
        categories: insight.summary.categories || {},
        transactions: rows.slice(0, 10).map(r => ({
          id: String(r.id),
          date: new Date(r.date).toISOString().slice(0, 10),
          merchant: r.merchant,
          description: r.description,
          amount: Number(r.amount),
          type: r.type,
          category: r.category,
          confidence: Number(r.confidence || 0),
          isAnomaly: Boolean(r.is_anomaly),
          anomalySeverity: r.anomaly_severity || "normal",
          zScore: Number(r.z_score || 0),
          isRecurring: Boolean(r.is_recurring),
          month: r.month,
        })),
        categoryBreakdown: insight.summary.category_breakdown || [],
        monthlyOverview: insight.monthly_overview || [],
        forecast: insight.forecast || {},
        anomalies: insight.anomalies || [],
        recurringMerchants: insight.recurring_merchants || [],
        mlInfo: insight.ml_info || { database: "Supabase PostgreSQL" },
      });
    }

    const debitRows = rows.filter((t) => t.type === "debit");
    const creditRows = rows.filter((t) => t.type === "credit");
    const totalDebit = debitRows.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalCredit = creditRows.reduce((sum, t) => sum + Number(t.amount), 0);
    const netSavings = totalCredit - totalDebit;

    const categoryMap: Record<string, number> = {};
    for (const txn of debitRows) {
      categoryMap[txn.category] = (categoryMap[txn.category] || 0) + Number(txn.amount);
    }

    const topCategories = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        category: name,
        amount: Number(amount.toFixed(2)),
        percentage: totalDebit > 0 ? Math.round((amount / totalDebit) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      summary: {
        healthScore: 78,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        netSavings: Number(netSavings.toFixed(2)),
        transactionCount: rows.length,
      },
      categories: categoryMap,
      transactions: rows.slice(0, 10).map(r => ({
        id: String(r.id),
        date: new Date(r.date).toISOString().slice(0, 10),
        merchant: r.merchant,
        description: r.description,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        confidence: Number(r.confidence || 0),
        isAnomaly: Boolean(r.is_anomaly),
        anomalySeverity: r.anomaly_severity || "normal",
        zScore: Number(r.z_score || 0),
        isRecurring: Boolean(r.is_recurring),
        month: r.month,
      })),
      categoryBreakdown: topCategories,
      monthlyOverview: [],
      anomalies: [],
      recurringMerchants: [],
      mlInfo: { database: "Supabase PostgreSQL" },
    });
  } catch (err: any) {
    console.error("[overview-route] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch overview", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
