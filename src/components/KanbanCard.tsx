"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-3">
        <p className="font-medium text-sm">{application.company}</p>
        <p className="text-xs text-muted-foreground">{application.role}</p>
        {application.appliedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(application.appliedAt), {
              addSuffix: true,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
