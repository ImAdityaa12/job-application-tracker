"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { GripVertical, Clock } from "lucide-react";

interface Application {
  id: string;
  company: string;
  role: string;
  appliedAt: string | null;
}

export function KanbanCard({
  application,
  onClick,
}: {
  application: Application;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: application.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing group transition-all duration-150 hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 shadow-lg rotate-1"
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{application.company}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{application.role}</p>
          </div>
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {application.appliedAt && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(application.appliedAt), {
              addSuffix: true,
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
