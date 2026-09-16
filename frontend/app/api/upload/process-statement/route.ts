import { NextRequest, NextResponse } from "next/server";
import { query, initDatabase } from "@/lib/db";
import { parseCsvText, processStatementData } from "@/lib/statement-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required (field: file)." }, { status: 400 });
    }

    const filename = file.name || "statement.csv";
    const userId = "demo-user";

    // 1. If an external ML service URL is configured (e.g. Railway or localhost), try it first
    const mlUrl = process.env.ML_SERVICE_URL;
    if (mlUrl) {
      try {
        const mlForm = new FormData();
        mlForm.append("file", file, filename);
        const mlRes = await fetch(`${mlUrl.replace(/\/+$/, "")}/api/process-statement`, {
          method: "POST",
          body: mlForm,
          headers: {
            // let fetch set multipart boundary
          },
        });
        if (mlRes.ok) {
          const mlData = await mlRes.json();
          // Save to Supabase
          await persistToSupabase(userId, filename, mlData);
          return NextResponse.json({
            success: true,
            userId,
            filename,
            transactionCount: mlData.transaction_count || mlData.transactions?.length || 0,
            ml: mlData,
          });
        }
      } catch (mlErr) {
        console.warn("[upload-route] External ML service call failed, using built-in engine:", mlErr);
      }
    }

    // 2. Built-in Next.js engine: reads CSV/text statements directly
    const text = await file.text();
    const rawRows = parseCsvText(text);

    if (!rawRows.length) {
      return NextResponse.json(
        {
          error: "No transactions could be parsed",
          message: "Make sure your file is a valid CSV statement with Date, Description, and Amount columns.",
        },
        { status: 422 }
      );
    }

    const analysis = processStatementData(rawRows, filename);

    // 3. Persist to Supabase PostgreSQL
    await persistToSupabase(userId, filename, analysis);

    return NextResponse.json({
      success: true,
      userId,
      filename,
      transactionCount: analysis.transaction_count,
      ml: analysis,
    });
  } catch (error: any) {
    console.error("[upload-route] Error processing statement:", error);
    return NextResponse.json(
      {
        error: "Upload processing failed",
        message: error?.message || "Unknown error during upload processing",
      },
      { status: 500 }
    );
  }
}

async function persistToSupabase(userId: string, filename: string, data: any) {
  try {
    await initDatabase();
    const txns = Array.isArray(data.transactions) ? data.transactions : [];

    for (const t of txns) {
      const d = new Date(t.date);
      const isoDate = !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
      await query(
        `INSERT INTO transactions (
          user_id, date, merchant, description, category, type, amount,
          confidence, is_anomaly, anomaly_severity, z_score, is_recurring,
          month, source, currency, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        [
          userId,
          isoDate,
          t.merchant || t.description || "Unknown",
          t.description || "Transaction",
          t.category || "Personal & UPI",
          String(t.type || "debit").toLowerCase(),
          t.amount || 0,
          t.confidence || 0,
          Boolean(t.is_anomaly),
          t.anomaly_severity || "normal",
          t.z_score || 0,
          Boolean(t.is_recurring),
          t.month || "Mar 2024",
          "upload",
          "INR",
        ]
      );
    }

    await query(
      `INSERT INTO user_insights (
        user_id, source_filename, summary, monthly_overview, forecast,
        recommendations, anomalies, recurring_merchants, ml_info, transaction_count,
        imported_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        source_filename = EXCLUDED.source_filename,
        summary = EXCLUDED.summary,
        monthly_overview = EXCLUDED.monthly_overview,
        forecast = EXCLUDED.forecast,
        recommendations = EXCLUDED.recommendations,
        anomalies = EXCLUDED.anomalies,
        recurring_merchants = EXCLUDED.recurring_merchants,
        ml_info = EXCLUDED.ml_info,
        transaction_count = EXCLUDED.transaction_count,
        imported_at = NOW(),
        updated_at = NOW()`,
      [
        userId,
        filename,
        JSON.stringify(data.summary || {}),
        JSON.stringify(data.monthly_overview || []),
        JSON.stringify(data.forecast || {}),
        JSON.stringify(data.recommendations || {}),
        JSON.stringify(data.anomalies || []),
        JSON.stringify(data.recurring_merchants || []),
        JSON.stringify(data.ml_info || {}),
        data.transaction_count || txns.length,
      ]
    );
  } catch (dbErr) {
    console.warn("[upload-route] Supabase persistence error:", dbErr);
  }
}
