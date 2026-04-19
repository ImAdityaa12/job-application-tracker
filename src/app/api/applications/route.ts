import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getRequiredSession();
    const rows = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, session.user.id))
      .orderBy(desc(applications.updatedAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getRequiredSession();
    const body = await request.json();

    const [app] = await db
      .insert(applications)
      .values({
        userId: session.user.id,
        company: body.company,
        role: body.role,
        status: body.status || "applied",
        appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
        jobUrl: body.jobUrl,
        notes: body.notes,
        salaryRange: body.salaryRange,
        location: body.location,
      })
      .returning();

    return NextResponse.json(app, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
