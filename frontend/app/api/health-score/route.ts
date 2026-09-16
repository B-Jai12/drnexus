import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txRes = await query("SELECT type, amount FROM transactions WHERE user_id = $1", ["demo-user"]);
    const rows = txRes.rows;
    const debit = rows.filter((r) => r.type === "debit").reduce((sum, r) => sum + Number(r.amount), 0);
    const credit = rows.filter((r) => r.type === "credit").reduce((sum, r) => sum + Number(r.amount), 0);
    const savingsRatio = credit > 0 ? Math.max(0, Math.min(1, (credit - debit) / credit)) : 0;
    const score = Math.min(100, Math.max(30, Math.round(50 + savingsRatio * 45)));

    return NextResponse.json({
      score,
      label: score >= 80 ? "Excellent" : score >= 65 ? "Good" : "Stable",
      breakdown: {
        spendingStability: 75,
        savingPotential: Math.round(score * 0.9),
        recurringCommitments: 70,
        cashflowPredictability: 75,
      },
    });
  } catch {
    return NextResponse.json({ score: 78, label: "Good", breakdown: {} });
  }
}
