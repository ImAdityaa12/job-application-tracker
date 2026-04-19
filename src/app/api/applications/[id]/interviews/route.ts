import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interviews } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { id } = await params;

    const rows = await db
      .select()
      .from(interviews)
      .where(
        and(
          eq(interviews.applicationId, id),
          eq(interviews.userId, session.user.id)
        )
      );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { id } = await params;
    const body = await request.json();

    const [interview] = await db
      .insert(interviews)
      .values({
        applicationId: id,
        userId: session.user.id,
        type: body.type,
        scheduledAt: new Date(body.scheduledAt),
        durationMinutes: body.durationMinutes || 60,
        location: body.location,
        notes: body.notes,
      })
      .returning();

    return NextResponse.json(interview, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
