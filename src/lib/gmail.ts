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

interface GmailFullMessage {
  id: string;
  payload: {
    mimeType: string;
    headers: { name: string; value: string }[];
    body?: { size: number; data?: string };
    parts?: GmailMessagePart[];
  };
  snippet: string;
}

interface GmailMessagePart {
  mimeType: string;
  body?: { size: number; data?: string };
  parts?: GmailMessagePart[];
}

interface GmailFullThread {
  id: string;
  messages: GmailFullMessage[];
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(part: GmailMessagePart): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  if (part.mimeType === "text/html" && part.body?.data) {
    html = decodeBase64Url(part.body.data);
  } else if (part.mimeType === "text/plain" && part.body?.data) {
    text = decodeBase64Url(part.body.data);
  }

  if (part.parts) {
    for (const subPart of part.parts) {
      const nested = extractBody(subPart);
      if (nested.html) html = nested.html;
      if (nested.text && !text) text = nested.text;
    }
  }

  return { html, text };
}

export interface FullEmailMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  isHtml: boolean;
}

export async function fetchFullThread(
  accessToken: string,
  gmailThreadId: string
): Promise<FullEmailMessage[]> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailThreadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch thread: ${err}`);
  }

  const thread: GmailFullThread = await res.json();

  return thread.messages.map((msg) => {
    const headers = msg.payload.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const { html, text } = extractBody(msg.payload as GmailMessagePart);

    // Prefer HTML, fall back to plain text
    const body = html || text || msg.snippet || "";
    const isHtml = !!html;

    return {
      id: msg.id,
      from: getHeader("From"),
      to: getHeader("To"),
      date: getHeader("Date"),
      subject: getHeader("Subject"),
      body,
      isHtml,
    };
  });
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// RFC 2047 encode a header value if it contains non-ASCII characters.
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(value)) {
    return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
  }
  return value;
}

export interface SendGmailResult {
  id: string;
  threadId: string;
}

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  /** Base64-encoded (standard, not URL-safe) file contents. */
  data: string;
}

// Wrap a base64 string to 76-character lines, as required for MIME bodies.
function wrapBase64(data: string): string {
  return data.replace(/[\r\n]/g, "").replace(/.{1,76}/g, "$&\r\n").trim();
}

// Sanitize a filename for use in MIME headers (strip quotes/control chars).
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\r\n"\\]|[\x00-\x1F]/g, "").trim();
  return cleaned || "attachment";
}

/**
 * Sends an email from the authenticated user's Gmail account. When
 * `attachments` are provided, the message is built as multipart/mixed.
 * Requires the `gmail.send` OAuth scope.
 */
export async function sendGmailMessage(
  accessToken: string,
  {
    to,
    subject,
    body,
    fromName,
    fromEmail,
    attachments,
  }: {
    to: string;
    subject: string;
    body: string;
    fromName?: string;
    fromEmail?: string;
    attachments?: GmailAttachment[];
  }
): Promise<SendGmailResult> {
  const from =
    fromName && fromEmail
      ? `${encodeHeader(fromName)} <${fromEmail}>`
      : fromEmail || undefined;

  const hasAttachments = !!attachments && attachments.length > 0;

  const baseHeaders = [
    `To: ${to}`,
    from ? `From: ${from}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ].filter(Boolean) as string[];

  let mime: string;

  if (!hasAttachments) {
    const headers = [
      ...baseHeaders,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
    ];
    mime = `${headers.join("\r\n")}\r\n\r\n${body}`;
  } else {
    const boundary = `=_jat_${toBase64Url(
      `${to}:${subject}:${attachments!.length}`
    ).slice(0, 24)}`;

    const parts: string[] = [];

    // Text part
    parts.push(
      [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        body,
      ].join("\r\n")
    );

    // Attachment parts
    for (const att of attachments!) {
      const filename = sanitizeFilename(att.filename);
      const mimeType = att.mimeType || "application/octet-stream";
      parts.push(
        [
          `--${boundary}`,
          `Content-Type: ${mimeType}; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${filename}"`,
          "",
          wrapBase64(att.data),
        ].join("\r\n")
      );
    }

    const headers = [
      ...baseHeaders,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ];

    mime = `${headers.join("\r\n")}\r\n\r\n${parts.join(
      "\r\n"
    )}\r\n--${boundary}--`;
  }

  const raw = toBase64Url(mime);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message || data?.error || "Failed to send email";
    // Surface a clear hint when the send scope hasn't been granted yet.
    if (
      res.status === 403 &&
      JSON.stringify(data).includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")
    ) {
      throw new Error(
        "Gmail send permission not granted. Re-connect your Google account in Settings to allow sending."
      );
    }
    throw new Error(message);
  }

  return { id: data.id, threadId: data.threadId };
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
