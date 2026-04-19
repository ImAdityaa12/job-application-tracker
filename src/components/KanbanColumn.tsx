"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const columnColors: Record<string, string> = {
  applied: "bg-blue-500",
  screening: "bg-amber-500",
  interview: "bg-emerald-500",
  offer: "bg-violet-500",
  rejected: "bg-red-400",
};

export function KanbanColumn({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors duration-150",
        isOver && "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", columnColors[id] || "bg-slate-400")} />
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
          {count}
        </Badge>
      </div>
      <div className="flex-1 overflow-hidden px-2 pb-2">{children}</div>
    </div>
  );
}
