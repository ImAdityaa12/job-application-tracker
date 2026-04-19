"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail,
  CalendarDays,
  MapPin,
  DollarSign,
  Plus,
  StickyNote,
  Clock,
} from "lucide-react";

interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedAt: string | null;
  lastActivityAt: string | null;
  jobUrl: string | null;
  notes: string | null;
  salaryRange: string | null;
  location: string | null;
}

interface Thread {
  id: string;
  subject: string;
  category: string;
  receivedAt: string | null;
}

interface Interview {
  id: string;
  type: string;
  scheduledAt: string;
  location: string | null;
  outcome: string | null;
}

const statusColors: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700 border-blue-200",
  screening: "bg-amber-50 text-amber-700 border-amber-200",
  interview: "bg-emerald-50 text-emerald-700 border-emerald-200",
  offer: "bg-violet-50 text-violet-700 border-violet-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  withdrawn: "bg-slate-50 text-slate-600 border-slate-200",
};

const outcomeColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export function ApplicationSheet({
  application,
  open,
  onClose,
}: {
  application: Application | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(application?.notes || "");
  const [showAddInterview, setShowAddInterview] = useState(false);

  const { data: threads } = useQuery<Thread[]>({
    queryKey: ["app-threads", application?.id],
    queryFn: () => fetch("/api/threads").then((r) => r.json()),
    enabled: !!application,
    select: (data) =>
      data.filter(
        (t: Thread & { applicationId?: string }) =>
          (t as Thread & { applicationId?: string }).applicationId ===
          application?.id
      ),
  });

  const { data: interviews } = useQuery<Interview[]>({
    queryKey: ["app-interviews", application?.id],
    queryFn: () =>
      fetch(`/api/applications/${application?.id}/interviews`).then((r) =>
        r.json()
      ),
    enabled: !!application,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Application>) =>
      fetch(`/api/applications/${application?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Updated");
    },
  });

  const addInterviewMutation = useMutation({
    mutationFn: (data: { type: string; scheduledAt: string; location?: string }) =>
      fetch(`/api/applications/${application?.id}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["app-interviews", application?.id],
      });
      setShowAddInterview(false);
      toast.success("Interview added");
    },
  });

  if (!application) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] overflow-y-auto sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="text-xl">{application.company}</SheetTitle>
          <p className="text-sm text-muted-foreground">{application.role}</p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Status & details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Badge
                variant="outline"
                className={`mt-1 block w-fit capitalize border ${statusColors[application.status] || ""}`}
              >
                {application.status}
              </Badge>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Applied
              </Label>
              <p className="font-medium text-sm mt-1">
                {application.appliedAt
                  ? new Date(application.appliedAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            {application.location && (
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </Label>
                <p className="font-medium text-sm mt-1">{application.location}</p>
              </div>
            )}
            {application.salaryRange && (
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Salary
                </Label>
                <p className="font-medium text-sm mt-1">{application.salaryRange}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Threads */}
          <div>
            <Label className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5" /> Email Threads
            </Label>
            {!threads || threads.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                No linked email threads
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {threads.map((thread) => (
                  <div key={thread.id} className="rounded-lg border p-2.5 text-sm hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">
                        {thread.subject}
                      </span>
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0 shrink-0">
                        {thread.category}
                      </Badge>
                    </div>
                    {thread.receivedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(thread.receivedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Interviews */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <CalendarDays className="h-3.5 w-3.5" /> Interviews
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => setShowAddInterview(!showAddInterview)}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {showAddInterview && (
              <form
                className="mt-3 space-y-3 rounded-lg border p-3 bg-muted/30"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  addInterviewMutation.mutate({
                    type: formData.get("type") as string,
                    scheduledAt: formData.get("scheduledAt") as string,
                    location: (formData.get("location") as string) || undefined,
                  });
                }}
              >
                <Select name="type" defaultValue="phone_screen">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone_screen">Phone Screen</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="offer_call">Offer Call</SelectItem>
                  </SelectContent>
                </Select>
                <Input name="scheduledAt" type="datetime-local" required />
                <Input name="location" placeholder="Zoom link, address..." />
                <Button type="submit" size="sm" className="w-full">
                  Save Interview
                </Button>
              </form>
            )}

            {interviews && interviews.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="rounded-lg border p-2.5 text-sm hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-sm">
                        {interview.type.replace("_", " ")}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-1.5 py-0 border ${
                          outcomeColors[interview.outcome || "pending"] || ""
                        }`}
                      >
                        {interview.outcome || "pending"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(interview.scheduledAt).toLocaleString()}
                    </p>
                    {interview.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {interview.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <Label className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <StickyNote className="h-3.5 w-3.5" /> Notes
            </Label>
            <Textarea
              className="mt-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== application.notes) {
                  updateMutation.mutate({ notes });
                }
              }}
              placeholder="Add notes..."
              rows={4}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
