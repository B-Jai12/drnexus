import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query(
      "SELECT recommendations FROM user_insights WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 1",
      ["demo-user"]
    );
    const recs = res.rows[0]?.recommendations;
    if (recs && Array.isArray(recs.items)) {
      return NextResponse.json(recs);
    }
    return NextResponse.json({
      summary: "AI generated recommendations based on your spending patterns.",
      items: [
        {
          id: "rec_1",
          title: "Optimize Top Spending Category",
          description: "Review top merchant concentration and set weekly spending caps.",
          category: "spending",
          priority: "high",
          potentialSavings: 1200,
          actionLabel: "Set Budget",
        },
        {
          id: "rec_2",
          title: "Automate Weekly Savings",
          description: "Setting up a 10% auto-transfer will build an emergency fund without impacting daily lifestyle.",
          category: "savings",
          priority: "medium",
          potentialSavings: 2000,
          actionLabel: "Start Saving",
        },
      ],
      totalPotentialSavings: 3200,
      aiGenerated: true,
    });
  } catch (err: any) {
    return NextResponse.json({ items: [], totalPotentialSavings: 0 });
  }
}
