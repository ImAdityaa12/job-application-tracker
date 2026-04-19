"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/SyncButton";
import { EmailViewer } from "@/components/EmailViewer";
import {
  Briefcase,
  Zap,
  CalendarCheck,
  Trophy,
  Mail,
  ArrowRight,
  Inbox,
} from "lucide-react";

interface Stats {
  total: number;
  active: number;
  interviewsUpcoming: number;
  offers: number;
  lastSyncedAt: string | null;
}

interface Thread {
  id: string;
  subject: string;
  fromName: string | null;
  category: string;
  priority: string;
  snippet: string | null;
  receivedAt: string | null;
}

const categoryConfig: Record<string, { class: string; dot: string }> = {
  signal: { class: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  interview: { class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  offer: { class: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  rejection: { class: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  confirmation: { class: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const statCards = [
  { key: "total", label: "Total Applications", icon: Briefcase, color: "text-teal-600", bg: "bg-teal-50" },
  { key: "active", label: "Active", icon: Zap, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "interviewsUpcoming", label: "Interviews (7d)", icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "offers", label: "Offers", icon: Trophy, color: "text-violet-600", bg: "bg-violet-50" },
] as const;

function StatSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="h-4 w-24 rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-12 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse flex items-start gap-3 rounded-lg border p-3">
          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    enabled: !!session,
  });

  const { data: threads, isLoading: threadsLoading } = useQuery<Thread[]>({
    queryKey: ["threads-recent"],
    queryFn: () => fetch("/api/threads").then((r) => r.json()),
    enabled: !!session,
  });

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  const recentSignals = (threads || [])
    .filter((t) => ["signal", "interview", "offer"].includes(t.category))
    .slice(0, 10);

  const hasNoData = !stats || stats.total === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your job applications at a glance
          </p>
        </div>
        <SyncButton lastSyncedAt={stats?.lastSyncedAt} />
      </div>

      {hasNoData && !statsLoading ? (
        <Card className="py-16 border-dashed border-2">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Welcome to Job Tracker
            </h2>
            <p className="text-muted-foreground mb-1 max-w-sm mx-auto">
              Click &ldquo;Sync Gmail&rdquo; to scan your inbox for job
              application emails and start tracking automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsLoading
              ? [1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)
              : statCards.map((card) => {
                  const Icon = card.icon;
                  const value = stats?.[card.key] ?? 0;
                  return (
                    <Card key={card.key} className="transition-shadow duration-150 hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {card.label}
                        </CardTitle>
                        <div className={`rounded-lg p-2 ${card.bg}`}>
                          <Icon className={`h-4 w-4 ${card.color}`} strokeWidth={2} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold tracking-tight">{value}</p>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              {recentSignals.length > 0 && (
                <button
                  onClick={() => router.push("/inbox")}
                  className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </CardHeader>
            <CardContent>
              {threadsLoading ? (
                <ActivitySkeleton />
              ) : recentSignals.length === 0 ? (
                <div className="text-center py-8">
                  <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSignals.map((thread) => {
                    const config = categoryConfig[thread.category] || categoryConfig.confirmation;
                    return (
                      <div
                        key={thread.id}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors duration-150 hover:bg-accent/50 cursor-pointer"
                        onClick={() => setSelectedThread(thread)}
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {thread.fromName || "Unknown"}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[11px] px-1.5 py-0 font-medium border ${config.class}`}
                            >
                              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
                              {thread.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {thread.subject}
                          </p>
                        </div>
                        {thread.receivedAt && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">
                            {new Date(thread.receivedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EmailViewer
        threadId={selectedThread?.id ?? null}
        threadMeta={selectedThread ? { subject: selectedThread.subject, category: selectedThread.category } : undefined}
        onClose={() => setSelectedThread(null)}
      />
    </div>
  );
}
