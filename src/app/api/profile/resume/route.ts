import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Upload (or replace) the resume file that gets attached to outreach emails.
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded." },
      { status: 400 }
    );
  }

  const mimeType = file.type || "application/pdf";
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Only PDF or Word documents are supported." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 5 MB)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const values = {
    resumeFileName: file.name || "resume.pdf",
    resumeFileData: buffer.toString("base64"),
    resumeMimeType: mimeType,
  };

  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id));

  if (existing) {
    await db
      .update(profiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(profiles.userId, session.user.id));
  } else {
    await db.insert(profiles).values({ userId: session.user.id, ...values });
  }

  return NextResponse.json({
    success: true,
    resumeFileName: values.resumeFileName,
    resumeMimeType: values.resumeMimeType,
  });
}

// Remove the stored resume file.
export async function DELETE() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(profiles)
    .set({
      resumeFileName: null,
      resumeFileData: null,
      resumeMimeType: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, session.user.id));

  return NextResponse.json({ success: true });
}
