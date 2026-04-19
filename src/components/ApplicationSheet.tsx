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
          <SheetTitle>{application.company}</SheetTitle>
          <p className="text-sm text-muted-foreground">{application.role}</p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p className="font-medium capitalize">{application.status}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Applied</Label>
              <p className="font-medium">
                {application.appliedAt
                  ? new Date(application.appliedAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            {application.location && (
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">{application.location}</p>
              </div>
            )}
            {application.salaryRange && (
              <div>
                <Label className="text-muted-foreground">Salary</Label>
                <p className="font-medium">{application.salaryRange}</p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-muted-foreground">Email Threads</Label>
            {!threads || threads.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                No linked email threads
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {threads.map((thread) => (
                  <div key={thread.id} className="rounded border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {thread.subject}
                      </span>
                      <Badge variant="secondary" className="text-xs">
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

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Interviews</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddInterview(!showAddInterview)}
              >
                Add Interview
              </Button>
            </div>

            {showAddInterview && (
              <form
                className="mt-3 space-y-3 rounded border p-3"
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
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
            )}

            {interviews && interviews.length > 0 && (
              <div className="mt-2 space-y-2">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="rounded border p-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">
                        {interview.type.replace("_", " ")}
                      </span>
                      <Badge variant="secondary">
                        {interview.outcome || "pending"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(interview.scheduledAt).toLocaleString()}
                    </p>
                    {interview.location && (
                      <p className="text-xs text-muted-foreground">
                        {interview.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-muted-foreground">Notes</Label>
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
