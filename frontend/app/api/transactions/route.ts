import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const type = url.searchParams.get("type") || "";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "ASC" : "DESC";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50")));

    const conditions = ["user_id = $1"];
    const values: any[] = ["demo-user"];

    if (category && category !== "all") {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (type && type !== "all") {
      values.push(type.toLowerCase());
      conditions.push(`type = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(merchant ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await query(`SELECT COUNT(*)::int as total FROM transactions WHERE ${whereClause}`, values);
    const total = countRes.rows[0]?.total || 0;

    const offset = (page - 1) * pageSize;
    const dataValues = [...values, pageSize, offset];
    const dataSql = `SELECT * FROM transactions WHERE ${whereClause} ORDER BY date ${sortOrder} LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`;

    const dataRes = await query(dataSql, dataValues);

    return NextResponse.json({
      data: dataRes.rows.map((r) => ({
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
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error("[transactions-route] Error:", err);
    return NextResponse.json({ data: [], total: 0 });
  }
}
