import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ClassifiedThread {
  threadId: string;
  company: string;
  role: string;
  category: "confirmation" | "signal" | "interview" | "offer" | "rejection";
  priority: "high" | "medium" | "low";
  interviewDate: string | null;
  summary: string;
}

interface ThreadInput {
  threadId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  snippet: string;
}

export async function classifyThreads(
  threads: ThreadInput[]
): Promise<ClassifiedThread[]> {
  if (threads.length === 0) return [];

  // Batch up to 20 at a time
  const results: ClassifiedThread[] = [];
  for (let i = 0; i < threads.length; i += 20) {
    const batch = threads.slice(i, i + 20);
    const batchResults = await classifyBatch(batch);
    results.push(...batchResults);
  }
  return results;
}

async function classifyBatch(
  threads: ThreadInput[]
): Promise<ClassifiedThread[]> {
  const prompt = `You are classifying job application emails for a developer job-hunting tracker.

For each thread, return a JSON array. Each item must have:
- threadId: string (the Gmail thread ID)
- company: string (extract company name, or "" if unclear)
- role: string (extract job title, or "" if unclear)
- category: "confirmation" | "signal" | "interview" | "offer" | "rejection"
  - confirmation: auto-reply, ATS receipt, "we got your application"
  - signal: real human reply, follow-up question, any non-automated response
  - interview: explicitly schedules or proposes an interview/call
  - offer: job offer
  - rejection: rejection notice
- priority: "high" | "medium" | "low"
  - high: interview, offer
  - medium: signal (human reply)
  - low: confirmation, rejection
- interviewDate: ISO datetime string if an interview date is mentioned, else null
- summary: one sentence describing this email

Threads:
${JSON.stringify(threads)}

Return ONLY a JSON array. No markdown, no extra text.`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    return JSON.parse(cleaned) as ClassifiedThread[];
  } catch {
    console.error("Failed to parse classification response:", text);
    return [];
  }
}
