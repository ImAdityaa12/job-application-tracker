import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sentEmails, profiles, applications } from "@/lib/db/schema";
import { and, eq, ilike } from "drizzle-orm";
import { getRequiredSession } from "@/lib/session";
import { getGoogleTokens, sendGmailMessage } from "@/lib/gmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common domains that don't represent a company name.
const GENERIC_DOMAINS = new Set([
  "gmail",
  "yahoo",
  "outlook",
  "hotmail",
  "icloud",
  "proton",
  "protonmail",
]);

// Best-effort company name from the recipient's email domain.
function companyFromEmail(email: string): string | null {
  const domain = email.split("@")[1];
  if (!domain) return null;
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const main = parts[parts.length - 2];
  if (GENERIC_DOMAINS.has(main.toLowerCase())) return null;
  return main.charAt(0).toUpperCase() + main.slice(1);
}

// Find an existing application by company (case-insensitive) or create one.
async function upsertApplication(
  userId: string,
  company: string,
  role: string | null
): Promise<string> {
  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.userId, userId), ilike(applications.company, company)));

  if (existing) {
    await db
      .update(applications)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(applications)
    .values({
      userId,
      company,
      role: role || "(role not specified)",
      status: "applied",
      appliedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .returning({ id: applications.id });

  return created.id;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const recipientEmail = (body.recipientEmail || "").trim();
  const subject = (body.subject || "").trim();
  const emailBody = (body.body || "").trim();
  const role = (body.role || "").trim() || null;
  const details = (body.details || "").trim() || null;
  const companyInput = (body.company || "").trim();
  const attachResume = body.attachResume === true;

  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json(
      { error: "A valid recipient email is required." },
      { status: 400 }
    );
  }
  if (!subject || !emailBody) {
    return NextResponse.json(
      { error: "Subject and body are required." },
      { status: 400 }
    );
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, session.user.id));
  const fromName = profile?.fullName || session.user.name || undefined;

  // Build the resume attachment when the sender opted in.
  let attachments: { filename: string; mimeType: string; data: string }[] | undefined;
  if (attachResume) {
    if (!profile?.resumeFileData) {
      return NextResponse.json(
        {
          error:
            "No resume file is uploaded. Upload one in Settings to attach it.",
        },
        { status: 400 }
      );
    }
    attachments = [
      {
        filename: profile.resumeFileName || "resume.pdf",
        mimeType: profile.resumeMimeType || "application/pdf",
        data: profile.resumeFileData,
      },
    ];
  }

  try {
    const { accessToken } = await getGoogleTokens(session.user.id);

    const sent = await sendGmailMessage(accessToken, {
      to: recipientEmail,
      subject,
      body: emailBody,
      fromName,
      fromEmail: session.user.email,
      attachments,
    });

    // Track this outreach as an application (create or update).
    const company = companyInput || companyFromEmail(recipientEmail);
    let applicationId: string | null = null;
    if (company) {
      try {
        applicationId = await upsertApplication(session.user.id, company, role);
      } catch (e) {
        console.error("Failed to upsert application for outreach:", e);
      }
    }

    await db.insert(sentEmails).values({
      userId: session.user.id,
      applicationId,
      toEmail: recipientEmail,
      company: company || null,
      role,
      details,
      subject,
      body: emailBody,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      status: "sent",
    });

    return NextResponse.json({ success: true, applicationId, ...sent });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send email.";

    // Record the failed attempt for visibility.
    await db.insert(sentEmails).values({
      userId: session.user.id,
      toEmail: recipientEmail,
      company: companyInput || companyFromEmail(recipientEmail) || null,
      role,
      details,
      subject,
      body: emailBody,
      status: "failed",
      errorMessage: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
