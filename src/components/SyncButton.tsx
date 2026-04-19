"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

export function SyncButton({ lastSyncedAt }: { lastSyncedAt?: string | null }) {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  async function handleSync() {
    setSyncing(true);
    const toastId = toast.loading(
      "Syncing Gmail — scanning inbox, fetching threads & classifying emails. This may take a minute...",
      { duration: Infinity }
    );

    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(
        `Sync complete: ${data.newThreads} new threads found out of ${data.threadsFound} total`,
        { id: toastId }
      );
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed", {
        id: toastId,
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleSync}
        disabled={syncing}
        className="min-w-[130px] gap-2 font-medium"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Gmail"}
      </Button>
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Last synced:{" "}
          {new Date(lastSyncedAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
