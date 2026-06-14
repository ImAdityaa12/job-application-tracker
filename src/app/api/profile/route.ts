import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getRequiredSession();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.user.id));

    if (!profile) return NextResponse.json(null);

    // Don't ship the (potentially large) base64 file blob to the client —
    // expose only whether one exists and its filename.
    const { resumeFileData, ...rest } = profile;
    return NextResponse.json({
      ...rest,
      hasResumeFile: !!resumeFileData,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getRequiredSession();
    const body = await request.json();

    const values = {
      fullName: typeof body.fullName === "string" ? body.fullName : null,
      resumeText: typeof body.resumeText === "string" ? body.resumeText : null,
    };

    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.user.id));

    if (existing) {
      const [updated] = await db
        .update(profiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(profiles.userId, session.user.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(profiles)
      .values({ userId: session.user.id, ...values })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
