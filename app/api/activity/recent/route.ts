import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const result = await admin
      .from("purchase_activity")
      .select("plan, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      console.error("Recent purchase activity could not be loaded", result.error);
      return NextResponse.json({ activity: null }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      result.data
        ? { activity: { plan: result.data.plan, createdAt: result.data.created_at } }
        : { activity: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Recent purchase activity endpoint failed", error);
    return NextResponse.json({ activity: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
