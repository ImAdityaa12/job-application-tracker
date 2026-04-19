import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, interviews, syncLogs } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getRequiredSession();
    const userId = session.user.id;

    const allApps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId));

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingInterviews = await db
      .select()
      .from(interviews)
      .where(
        and(
          eq(interviews.userId, userId),
          gte(interviews.scheduledAt, now)
        )
      );

    const [lastSync] = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.userId, userId))
      .orderBy(desc(syncLogs.syncedAt))
      .limit(1);

    const total = allApps.length;
    const active = allApps.filter(
      (a) => !["rejected", "withdrawn"].includes(a.status)
    ).length;
    const interviewsUpcoming = upcomingInterviews.filter(
      (i) => i.scheduledAt <= sevenDaysFromNow
    ).length;
    const offers = allApps.filter((a) => a.status === "offer").length;

    return NextResponse.json({
      total,
      active,
      interviewsUpcoming,
      offers,
      lastSyncedAt: lastSync?.syncedAt || null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
