"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ApplicationsPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { company: string; role: string; jobUrl?: string }) =>
      fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setOpen(false);
      toast.success("Application added");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            Add Application
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Application</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createMutation.mutate({
                  company: formData.get("company") as string,
                  role: formData.get("role") as string,
                  jobUrl: (formData.get("jobUrl") as string) || undefined,
                });
              }}
            >
              <div>
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" required />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" name="role" required />
              </div>
              <div>
                <Label htmlFor="jobUrl">Job URL (optional)</Label>
                <Input id="jobUrl" name="jobUrl" type="url" />
              </div>
              <Button type="submit" className="w-full">
                Add
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <KanbanBoard />
    </div>
  );
}
