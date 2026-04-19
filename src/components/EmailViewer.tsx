"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Calendar } from "lucide-react";
import { useRef, useEffect } from "react";

interface FullEmailMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  isHtml: boolean;
}

interface EmailViewerProps {
  threadId: string | null;
  threadMeta?: {
    subject: string;
    category: string;
  };
  onClose: () => void;
}

const categoryConfig: Record<string, { class: string; dot: string }> = {
  signal: { class: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  interview: { class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  offer: { class: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  rejection: { class: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  confirmation: { class: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  unclassified: { class: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

function SandboxedHtml({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #374151;
            margin: 0;
            padding: 8px;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          a { color: #2563eb; }
          img { max-width: 100%; height: auto; }
          table { max-width: 100%; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `);
    doc.close();

    // Auto-resize iframe to content height
    const resizeObserver = new ResizeObserver(() => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + "px";
      }
    });

    if (iframe.contentDocument?.body) {
      resizeObserver.observe(iframe.contentDocument.body);
      iframe.style.height = iframe.contentDocument.body.scrollHeight + "px";
    }

    return () => resizeObserver.disconnect();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      className="w-full border-0 min-h-[100px]"
      title="Email content"
    />
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
            <div className="h-3 w-3/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function parseSender(from: string) {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  return {
    name: match ? match[1].replace(/"/g, "") : from,
    email: match ? match[2] : from,
  };
}

export function EmailViewer({ threadId, threadMeta, onClose }: EmailViewerProps) {
  const { data, isLoading, error } = useQuery<{ messages: FullEmailMessage[] }>({
    queryKey: ["thread-full", threadId],
    queryFn: () => fetch(`/api/threads/${threadId}/gmail`).then((r) => r.json()),
    enabled: !!threadId,
  });

  const catConfig = categoryConfig[threadMeta?.category || ""] || categoryConfig.unclassified;

  return (
    <Sheet open={!!threadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="flex-1 truncate pr-8">
              {threadMeta?.subject || "Email Thread"}
            </SheetTitle>
            {threadMeta?.category && (
              <Badge
                variant="outline"
                className={`text-[11px] px-1.5 py-0 font-medium border shrink-0 ${catConfig.class}`}
              >
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${catConfig.dot}`} />
                {threadMeta.category}
              </Badge>
            )}
          </div>
          <SheetDescription>Full email conversation</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {isLoading ? (
            <MessageSkeleton />
          ) : error ? (
            <div className="text-center py-8">
              <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Failed to load email content</p>
            </div>
          ) : (
            data?.messages.map((msg) => {
              const sender = parseSender(msg.from);
              return (
                <div key={msg.id} className="rounded-lg border">
                  <div className="flex items-start gap-3 p-3 border-b bg-muted/30">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{sender.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{sender.email}</p>
                    </div>
                    {msg.date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Calendar className="h-3 w-3" />
                        {new Date(msg.date).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    {msg.isHtml ? (
                      <SandboxedHtml html={msg.body} />
                    ) : (
                      <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                        {msg.body}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
