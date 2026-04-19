import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getRequiredSession();

    const rows = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.userId, session.user.id))
      .orderBy(desc(emailThreads.receivedAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
