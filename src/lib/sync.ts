import { db } from "./db";
import {
  applications,
  emailThreads,
  interviews,
  syncLogs,
} from "./db/schema";
import {
  getGoogleTokens,
  searchGmailThreads,
  fetchThreadDetails,
  extractThreadMetadata,
} from "./gmail";
import { classifyThreads } from "./classify";
import { eq, and } from "drizzle-orm";

export async function syncUserGmail(userId: string) {
  const { accessToken } = await getGoogleTokens(userId);

  // 1. Search Gmail for job-related threads
  const gmailThreads = await searchGmailThreads(accessToken);

  // 2. Filter out already-synced threads
  const existingThreads = await db
    .select({ gmailThreadId: emailThreads.gmailThreadId })
    .from(emailThreads)
    .where(eq(emailThreads.userId, userId));

  const existingIds = new Set(existingThreads.map((t) => t.gmailThreadId));
  const newThreadIds = gmailThreads
    .map((t) => t.id)
    .filter((id) => !existingIds.has(id));

  if (newThreadIds.length === 0) {
    await db.insert(syncLogs).values({
      userId,
      threadsFound: gmailThreads.length,
      newThreads: 0,
      status: "success",
    });

    return { threadsFound: gmailThreads.length, newThreads: 0 };
  }

  // 3. Fetch full thread details
  const threadDetails = await fetchThreadDetails(accessToken, newThreadIds);
  const threadMetadata = threadDetails.map(extractThreadMetadata);

  // 4. Classify with Claude
  const classified = await classifyThreads(
    threadMetadata.map((t) => ({
      threadId: t.threadId,
      subject: t.subject,
      fromName: t.fromName,
      fromEmail: t.fromEmail,
      snippet: t.snippet,
    }))
  );

  // 5. Save threads and create/update applications
  let newThreadCount = 0;
  for (const cls of classified) {
    const meta = threadMetadata.find((m) => m.threadId === cls.threadId);
    if (!meta) continue;

    // Insert email thread
    await db.insert(emailThreads).values({
      userId,
      gmailThreadId: cls.threadId,
      subject: meta.subject,
      fromEmail: meta.fromEmail,
      fromName: meta.fromName,
      snippet: meta.snippet,
      category: cls.category,
      priority: cls.priority,
      receivedAt: meta.receivedAt,
    });
    newThreadCount++;

    // Auto-create or update application
    if (cls.company) {
      const [existingApp] = await db
        .select()
        .from(applications)
        .where(
          and(
            eq(applications.userId, userId),
            eq(applications.company, cls.company)
          )
        );

      if (existingApp) {
        const statusMap: Record<string, string> = {
          interview: "interview",
          offer: "offer",
          rejection: "rejected",
        };
        const newStatus = statusMap[cls.category];
        const updatedThreadIds = [
          ...(existingApp.gmailThreadIds || []),
          cls.threadId,
        ];

        await db
          .update(applications)
          .set({
            ...(newStatus ? { status: newStatus } : {}),
            lastActivityAt: new Date(),
            gmailThreadIds: updatedThreadIds,
            updatedAt: new Date(),
          })
          .where(eq(applications.id, existingApp.id));

        // Link thread to application
        await db
          .update(emailThreads)
          .set({ applicationId: existingApp.id })
          .where(eq(emailThreads.gmailThreadId, cls.threadId));

        // Create interview if applicable
        if (cls.category === "interview" && cls.interviewDate) {
          await db.insert(interviews).values({
            applicationId: existingApp.id,
            userId,
            type: "phone_screen",
            scheduledAt: new Date(cls.interviewDate),
          });
        }
      } else if (cls.category !== "confirmation") {
        const [newApp] = await db
          .insert(applications)
          .values({
            userId,
            company: cls.company,
            role: cls.role || "Unknown Role",
            status:
              cls.category === "interview"
                ? "interview"
                : cls.category === "offer"
                  ? "offer"
                  : cls.category === "rejection"
                    ? "rejected"
                    : "applied",
            appliedAt: meta.receivedAt || new Date(),
            lastActivityAt: new Date(),
            gmailThreadIds: [cls.threadId],
          })
          .returning();

        // Link thread to new application
        await db
          .update(emailThreads)
          .set({ applicationId: newApp.id })
          .where(eq(emailThreads.gmailThreadId, cls.threadId));

        // Create interview if applicable
        if (cls.category === "interview" && cls.interviewDate) {
          await db.insert(interviews).values({
            applicationId: newApp.id,
            userId,
            type: "phone_screen",
            scheduledAt: new Date(cls.interviewDate),
          });
        }
      }
    }
  }

  // 6. Log sync
  await db.insert(syncLogs).values({
    userId,
    threadsFound: gmailThreads.length,
    newThreads: newThreadCount,
    status: "success",
  });

  return { threadsFound: gmailThreads.length, newThreads: newThreadCount };
}
