import { db } from "./db";
import { account } from "./db/schema";
import { eq, and } from "drizzle-orm";

interface GmailThread {
  id: string;
  snippet: string;
  historyId: string;
}

interface GmailThreadDetail {
  id: string;
  messages: {
    id: string;
    payload: {
      headers: { name: string; value: string }[];
    };
    snippet: string;
  }[];
}

export async function getGoogleTokens(userId: string) {
  const [acc] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));

  if (!acc) throw new Error("No Google account linked");

  // Check if access token is expired
  if (acc.accessTokenExpiresAt && acc.accessTokenExpiresAt < new Date()) {
    return refreshAccessToken(acc);
  }

  return {
    accessToken: acc.accessToken!,
    refreshToken: acc.refreshToken!,
  };
}

async function refreshAccessToken(acc: {
  id: string;
  refreshToken: string | null;
}) {
  if (!acc.refreshToken) throw new Error("No refresh token available");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: acc.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error}`);

  // Update stored token
  await db
    .update(account)
    .set({
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(account.id, acc.id));

  return {
    accessToken: data.access_token as string,
    refreshToken: acc.refreshToken,
  };
}

const SEARCH_QUERIES = [
  '"your application" OR "thank you for applying" newer_than:60d',
  '"interview" OR "technical assessment" OR "coding challenge" newer_than:60d',
  '"offer letter" OR "job offer" newer_than:60d',
  '"unfortunately" OR "not moving forward" OR "other candidates" newer_than:60d',
];

export async function searchGmailThreads(accessToken: string) {
  const allThreadIds = new Set<string>();
  const threads: GmailThread[] = [];

  for (const query of SEARCH_QUERIES) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail search failed: ${err}`);
    }

    const data = await res.json();
    if (data.threads) {
      for (const t of data.threads) {
        if (!allThreadIds.has(t.id)) {
          allThreadIds.add(t.id);
          threads.push(t);
        }
      }
    }
  }

  return threads;
}

export async function fetchThreadDetails(
  accessToken: string,
  threadIds: string[]
): Promise<GmailThreadDetail[]> {
  const results: GmailThreadDetail[] = [];

  for (let i = 0; i < threadIds.length; i++) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadIds[i]}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) continue;
    results.push(await res.json());

    // Rate limiting: 100ms delay if fetching more than 20
    if (threadIds.length > 20 && i < threadIds.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}

export function extractThreadMetadata(thread: GmailThreadDetail) {
  const firstMessage = thread.messages[0];
  const headers = firstMessage?.payload?.headers || [];

  const subject =
    headers.find((h) => h.name === "Subject")?.value || "(no subject)";
  const from = headers.find((h) => h.name === "From")?.value || "";
  const date = headers.find((h) => h.name === "Date")?.value;

  // Parse "Name <email>" format
  const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : from;
  const fromEmail = fromMatch ? fromMatch[2] : from;

  return {
    threadId: thread.id,
    subject,
    fromName,
    fromEmail,
    snippet: firstMessage?.snippet || "",
    receivedAt: date ? new Date(date) : null,
  };
}
