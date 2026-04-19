import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getRequiredSession();
    const { id } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(emailThreads)
      .set(body)
      .where(eq(emailThreads.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
