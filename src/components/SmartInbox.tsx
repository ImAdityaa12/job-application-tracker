"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Inbox, Mail, ArrowUpRight } from "lucide-react";

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

const categoryConfig: Record<string, { class: string; dot: string }> = {
  signal: { class: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  interview: { class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  offer: { class: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  rejection: { class: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  confirmation: { class: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  unclassified: { class: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

const priorityConfig: Record<string, { class: string }> = {
  high: { class: "bg-red-50 text-red-700 border-red-200" },
  medium: { class: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { class: "bg-slate-50 text-slate-500 border-slate-200" },
};

function ThreadRow({ thread }: { thread: Thread }) {
  const catConfig = categoryConfig[thread.category] || categoryConfig.confirmation;
  const priConfig = priorityConfig[thread.priority || "low"] || priorityConfig.low;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3.5 hover:bg-accent/50 hover:border-primary/20 transition-all duration-150 group">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {thread.fromName || thread.fromEmail || "Unknown"}
            </span>
            <Badge
              variant="outline"
              className={`text-[11px] px-1.5 py-0 font-medium border ${catConfig.class}`}
            >
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${catConfig.dot}`} />
              {thread.category}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[11px] px-1.5 py-0 font-medium border ${priConfig.class}`}
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
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        {thread.receivedAt && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(thread.receivedAt).toLocaleDateString()}
          </span>
        )}
        {thread.applicationId ? (
          <Link
            href="/applications"
            className="flex items-center gap-0.5 text-xs text-primary font-medium hover:underline"
          >
            View <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Unlinked</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse flex items-center gap-3 rounded-lg border p-3.5">
          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-52 rounded bg-muted" />
          </div>
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function SmartInbox() {
  const { data: threads = [], isLoading } = useQuery<Thread[]>({
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
        {isLoading ? (
          <ThreadListSkeleton />
        ) : needsAttention.length === 0 ? (
          <EmptyState message="No emails that need attention" />
        ) : (
          <div className="space-y-2">
            {needsAttention.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="confirmations" className="mt-4">
        {isLoading ? (
          <ThreadListSkeleton />
        ) : confirmations.length === 0 ? (
          <EmptyState message="No auto-confirmations" />
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
