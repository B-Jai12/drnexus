import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    id: "user_001",
    name: "Jaideep",
    email: "jaideep@example.com",
    currency: "INR",
    memberSince: "2024-01-01",
  });
}
