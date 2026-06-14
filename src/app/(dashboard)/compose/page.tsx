"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Send, FileText, RotateCw, AlertCircle } from "lucide-react";

interface Profile {
  fullName: string | null;
  resumeText: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ComposePage() {
  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: () => fetch("/api/profile").then((r) => r.json()),
  });

  const [recipientEmail, setRecipientEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [details, setDetails] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const hasResume = !!profile?.resumeText;

  async function handleGenerate() {
    if (!role.trim()) return toast.error("Enter the job role.");
    if (!EMAIL_RE.test(recipientEmail.trim()))
      return toast.error("Enter a valid recipient email.");

    setGenerating(true);
    const toastId = toast.loading("Generating email from your resume...", {
      duration: Infinity,
    });
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, company, role, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");

      setSubject(data.subject);
      setBody(data.body);
      setHasDraft(true);
      toast.success("Draft ready — review and edit before sending.", {
        id: toastId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", {
        id: toastId,
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim())
      return toast.error("Subject and body cannot be empty.");
    if (!EMAIL_RE.test(recipientEmail.trim()))
      return toast.error("Enter a valid recipient email.");

    setSending(true);
    const toastId = toast.loading(`Sending to ${recipientEmail}...`, {
      duration: Infinity,
    });
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail,
          company,
          subject,
          body,
          role,
          details,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      toast.success(`Email sent to ${recipientEmail}`, { id: toastId });
      // Reset the draft so it can't be sent twice by accident.
      setSubject("");
      setBody("");
      setHasDraft(false);
      setRecipientEmail("");
      setCompany("");
      setRole("");
      setDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed", {
        id: toastId,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compose Application</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate a short, tailored application email from your resume and send
          it straight from your Gmail.
        </p>
      </div>

      {!profileLoading && !hasResume && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">No resume saved yet</p>
              <p className="text-amber-800 mt-0.5">
                Add your resume in{" "}
                <Link href="/settings" className="font-medium underline">
                  Settings
                </Link>{" "}
                so emails can be generated from it.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recipient" className="text-sm font-medium">
                Send to <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recruiter@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm font-medium">
                Role <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-sm font-medium">
              Company{" "}
              <span className="text-muted-foreground font-normal">
                (optional — used to track this application)
              </span>
            </Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Inc."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="details" className="text-sm font-medium">
              Job details{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Paste the job description or any specifics to tailor the email to..."
              className="min-h-28"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !hasResume}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
            {generating
              ? "Generating..."
              : hasDraft
                ? "Regenerate"
                : "Generate Email"}
          </Button>
        </CardContent>
      </Card>

      {hasDraft && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Review &amp; Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body" className="text-sm font-medium">
                Message
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-72 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSend} disabled={sending} className="gap-2">
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send Email"}
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2"
              >
                <RotateCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sends from your connected Gmail account. Review carefully — this
              goes out immediately.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
