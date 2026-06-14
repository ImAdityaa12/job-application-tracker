"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, Save, Upload, Paperclip, Trash2 } from "lucide-react";

interface Profile {
  fullName: string | null;
  resumeText: string | null;
  resumeFileName: string | null;
  hasResumeFile: boolean;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

  async function handleFileUpload(file: File) {
    setUploading(true);
    const toastId = toast.loading("Uploading resume file...", {
      duration: Infinity,
    });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/resume", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Resume file uploaded", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: toastId,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveFile() {
    setUploading(true);
    try {
      const res = await fetch("/api/profile/resume", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Resume file removed");
    } catch {
      toast.error("Could not remove the file. Try again.");
    } finally {
      setUploading(false);
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

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            Resume file (PDF)
          </Label>
          <p className="text-sm text-muted-foreground">
            Upload the PDF you want to send as an attachment. You can toggle
            attaching it per-email on the{" "}
            <span className="font-medium text-foreground">Compose</span> page.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />

          {profile?.hasResumeFile ? (
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">
                {profile.resumeFileName || "resume.pdf"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                disabled={uploading}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload resume PDF"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
