"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Save } from "lucide-react";

interface Profile {
  fullName: string | null;
  resumeText: string | null;
}

export function ResumeSettings() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: () => fetch("/api/profile").then((r) => r.json()),
  });

  const [fullName, setFullName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setFullName(profile.fullName ?? "");
      setResumeText(profile.resumeText ?? "");
      setHydrated(true);
    }
  }, [profile, hydrated]);

  async function handleSave() {
    if (!resumeText.trim()) {
      toast.error("Paste your resume before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, resumeText }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Resume saved");
    } catch {
      toast.error("Could not save your resume. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <CardTitle className="text-base">Resume</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste your resume here. It&apos;s used to generate tailored
          application emails on the{" "}
          <span className="font-medium text-foreground">Compose</span> page. It
          is never shared or sent as-is.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-sm font-medium">
            Display name (used in the signature)
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Jane Doe"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resumeText" className="text-sm font-medium">
            Resume text
          </Label>
          <Textarea
            id="resumeText"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste the full text of your resume..."
            className="min-h-64 font-mono text-xs"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            {resumeText.length.toLocaleString()} characters
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving || isLoading} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Resume"}
        </Button>
      </CardContent>
    </Card>
  );
}
