import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GenerateEmailInput {
  resumeText: string;
  fullName: string;
  senderEmail: string;
  role: string;
  company?: string;
  details?: string;
  recipientEmail: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export async function generateApplicationEmail(
  input: GenerateEmailInput
): Promise<GeneratedEmail> {
  const {
    resumeText,
    fullName,
    senderEmail,
    role,
    company,
    details,
    recipientEmail,
  } = input;

  const prompt = `You are writing a short, professional cold job-application email on behalf of a candidate.

Candidate name: ${fullName || "(not provided)"}
Candidate email: ${senderEmail}
Recipient email: ${recipientEmail}
Role being applied for: ${role}
${company ? `Company: ${company}` : ""}
${details ? `Additional job details:\n${details}` : "No extra job details were provided."}

Candidate's resume:
"""
${resumeText}
"""

Write the email following these rules:
- Keep it SHORT and crisp: 90-150 words in the body. No fluff, no clichés.
- Open with a brief, specific line stating interest in the "${role}" role.
- Pull 2-3 of the most relevant achievements/skills from the resume that fit this role. Be concrete (technologies, impact, scale) but do not invent anything not in the resume.
- If job details were provided, tailor the relevance to them.
- Professional, confident, friendly tone. Plain text only (no markdown, no bullet characters, no links unless they appear in the resume).
- End with a polite call to action and a signature using the candidate's name${fullName ? ` ("${fullName}")` : ""}.
- Write a concise, specific subject line (max ~70 chars), e.g. "Application: ${role} — <name>".

Return ONLY a JSON object with exactly these keys, no markdown fences, no extra text:
{"subject": "string", "body": "string"}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let parsed: GeneratedEmail;
  try {
    parsed = JSON.parse(cleaned) as GeneratedEmail;
  } catch {
    console.error("Failed to parse generated email response:", text);
    throw new Error("Could not generate the email. Please try again.");
  }

  if (!parsed.subject || !parsed.body) {
    throw new Error("Generated email was incomplete. Please try again.");
  }

  return { subject: parsed.subject.trim(), body: parsed.body.trim() };
}
