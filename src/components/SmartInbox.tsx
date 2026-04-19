"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface Thread {
  id: string;
  gmailThreadId: string;
  applicationId: string | null;
  subject: string;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  category: string;
  priority: string;
  receivedAt: string | null;
}

const categoryColors: Record<string, string> = {
  signal: "bg-blue-100 text-blue-800",
  interview: "bg-green-100 text-green-800",
  offer: "bg-purple-100 text-purple-800",
  rejection: "bg-red-100 text-red-800",
  confirmation: "bg-gray-100 text-gray-800",
  unclassified: "bg-yellow-100 text-yellow-800",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-gray-100 text-gray-800",
};

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {thread.fromName || thread.fromEmail || "Unknown"}
          </span>
          <Badge
            variant="secondary"
            className={`text-xs ${categoryColors[thread.category] || ""}`}
          >
            {thread.category}
          </Badge>
          <Badge
            variant="secondary"
            className={`text-xs ${priorityColors[thread.priority || "low"] || ""}`}
          >
            {thread.priority}
          </Badge>
        </div>
        <p className="text-sm truncate mt-0.5">{thread.subject}</p>
        {thread.snippet && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {thread.snippet}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        {thread.receivedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(thread.receivedAt).toLocaleDateString()}
          </span>
        )}
        {thread.applicationId ? (
          <Link
            href="/applications"
            className="text-xs text-primary hover:underline"
          >
            View App
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Unlinked</span>
        )}
      </div>
    </div>
  );
}

export function SmartInbox() {
  const { data: threads = [] } = useQuery<Thread[]>({
    queryKey: ["threads"],
    queryFn: () => fetch("/api/threads").then((r) => r.json()),
  });

  const needsAttention = threads.filter(
    (t) => t.category !== "confirmation" && t.category !== "unclassified"
  );
  const confirmations = threads.filter(
    (t) => t.category === "confirmation"
  );

  return (
    <Tabs defaultValue="attention">
      <TabsList>
        <TabsTrigger value="attention">
          Needs Attention ({needsAttention.length})
        </TabsTrigger>
        <TabsTrigger value="confirmations">
          Auto-confirmations ({confirmations.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="attention" className="mt-4">
        {needsAttention.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No emails that need attention
          </p>
        ) : (
          <div className="space-y-2">
            {needsAttention.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="confirmations" className="mt-4">
        {confirmations.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No auto-confirmations
          </p>
        ) : (
          <div className="space-y-2">
            {confirmations.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
