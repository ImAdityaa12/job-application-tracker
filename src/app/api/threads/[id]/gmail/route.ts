import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";
import { getGoogleTokens, fetchFullThread } from "@/lib/gmail";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { id } = await params;

    // Look up the thread in DB to get the Gmail thread ID
    const [thread] = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.id, id));

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Get user's Google tokens and fetch full email content
    const { accessToken } = await getGoogleTokens(session.user.id);
    const messages = await fetchFullThread(accessToken, thread.gmailThreadId);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Fetch full thread error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch email" },
      { status: 500 }
    );
  }
}
