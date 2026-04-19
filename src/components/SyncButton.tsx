"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function SyncButton({ lastSyncedAt }: { lastSyncedAt?: string | null }) {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(
        `Sync complete: ${data.newThreads} new threads found out of ${data.threadsFound} total`
      );
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleSync} disabled={syncing}>
        {syncing ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Syncing...
          </>
        ) : (
          "Sync Gmail"
        )}
      </Button>
      {lastSyncedAt && (
        <span className="text-sm text-muted-foreground">
          Last synced:{" "}
          {new Date(lastSyncedAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
