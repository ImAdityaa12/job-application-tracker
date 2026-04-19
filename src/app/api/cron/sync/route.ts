import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { syncUserGmail } from "@/lib/sync";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all users with a linked Google account
  const googleAccounts = await db
    .select({ userId: account.userId })
    .from(account)
    .where(eq(account.providerId, "google"));

  const uniqueUserIds = [...new Set(googleAccounts.map((a) => a.userId))];

  const results: { userId: string; status: string; newThreads?: number; error?: string }[] = [];

  for (const userId of uniqueUserIds) {
    try {
      const result = await syncUserGmail(userId);
      results.push({ userId, status: "success", newThreads: result.newThreads });
    } catch (error) {
      console.error(`Cron sync failed for user ${userId}:`, error);
      results.push({
        userId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
  });
}
