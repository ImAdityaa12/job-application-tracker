import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";
import { generateApplicationEmail } from "@/lib/generate-email";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const role = (body.role || "").trim();
    const recipientEmail = (body.recipientEmail || "").trim();
    const details = (body.details || "").trim();
    const company = (body.company || "").trim();

    if (!role) {
      return NextResponse.json(
        { error: "Job role is required." },
        { status: 400 }
      );
    }
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Recipient email is required." },
        { status: 400 }
      );
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.user.id));

    if (!profile?.resumeText) {
      return NextResponse.json(
        { error: "Add your resume in Settings before generating an email." },
        { status: 400 }
      );
    }

    const email = await generateApplicationEmail({
      resumeText: profile.resumeText,
      fullName: profile.fullName || session.user.name || "",
      senderEmail: session.user.email,
      role,
      company: company || undefined,
      details: details || undefined,
      recipientEmail,
    });

    return NextResponse.json(email);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate email.",
      },
      { status: 500 }
    );
  }
}
