"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/SyncButton";

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

const categoryColors: Record<string, string> = {
  signal: "bg-blue-100 text-blue-800",
  interview: "bg-green-100 text-green-800",
  offer: "bg-purple-100 text-purple-800",
  rejection: "bg-red-100 text-red-800",
  confirmation: "bg-gray-100 text-gray-800",
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    enabled: !!session,
  });

  const { data: threads } = useQuery<Thread[]>({
    queryKey: ["threads-recent"],
    queryFn: () => fetch("/api/threads").then((r) => r.json()),
    enabled: !!session,
  });

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <SyncButton lastSyncedAt={stats?.lastSyncedAt} />
      </div>

      {hasNoData ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <h2 className="text-xl font-semibold mb-2">
              Welcome to Job Tracker
            </h2>
            <p className="text-muted-foreground mb-4">
              Click &ldquo;Sync Gmail&rdquo; to scan your inbox for job application
              emails and start tracking automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats?.active ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Interviews (7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {stats?.interviewsUpcoming ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats?.offers ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSignals.length === 0 ? (
                <p className="text-muted-foreground">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentSignals.map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-start justify-between rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {thread.fromName || "Unknown"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={categoryColors[thread.category] || ""}
                          >
                            {thread.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {thread.subject}
                        </p>
                      </div>
                      {thread.receivedAt && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(thread.receivedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
