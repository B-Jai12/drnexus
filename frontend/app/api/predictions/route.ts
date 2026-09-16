import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query(
      "SELECT forecast, monthly_overview, anomalies FROM user_insights WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 1",
      ["demo-user"]
    );
    const row = res.rows[0];
    const forecastObj = row?.forecast || {};
    const monthlyOverview = Array.isArray(row?.monthly_overview) ? row.monthly_overview : [];

    const forecast = monthlyOverview.map((m: any) => ({
      month: m.month,
      actual: Number(m.expenses || 0),
      predicted: Number(m.expenses || 0),
      confidence: 80,
    }));

    forecast.push({
      month: "Next Month",
      actual: null,
      predicted: Number(forecastObj.predicted_expense || 15000),
      confidence: 85,
    });

    return NextResponse.json({
      nextMonthEstimate: Number(forecastObj.predicted_expense || 15000),
      riskLevel: "medium",
      categoryRisks: [],
      forecast,
      alerts: Array.isArray(row?.anomalies)
        ? row.anomalies.map((a: any, idx: number) => ({
            id: `a-${idx + 1}`,
            severity: a.severity || "medium",
            title: `${a.merchant || "Merchant"} unusual transaction`,
            description: `Detected anomalous spend of ₹${Number(a.amount || 0).toLocaleString()}.`,
            category: "Anomaly",
            amount: Number(a.amount || 0),
          }))
        : [],
      cards: [
        {
          month: "Next Month Forecast",
          predicted: Number(forecastObj.predicted_expense || 15000),
          actual: null,
          confidence: 85,
        },
        {
          month: "Predicted Income",
          predicted: Number(forecastObj.predicted_income || 20000),
          actual: null,
          confidence: 75,
        },
        {
          month: "Predicted Savings",
          predicted: Number(forecastObj.predicted_savings || 5000),
          actual: null,
          confidence: 75,
        },
      ],
      overall_confidence: 85,
    });
  } catch (err: any) {
    return NextResponse.json({ forecast: [], cards: [], alerts: [] });
  }
}
