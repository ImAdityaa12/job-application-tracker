"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApplicationSheet } from "./ApplicationSheet";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

export interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedAt: string | null;
  lastActivityAt: string | null;
  jobUrl: string | null;
  notes: string | null;
  salaryRange: string | null;
  location: string | null;
  gmailThreadIds: string[] | null;
}

const COLUMNS = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
];

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: () => fetch("/api/applications").then((r) => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appId = active.id as string;
    const newStatus = over.id as string;

    const app = applications.find((a) => a.id === appId);
    if (app && app.status !== newStatus && COLUMNS.some((c) => c.id === newStatus)) {
      updateStatus.mutate({ id: appId, status: newStatus });
    }
  }

  const activeApp = applications.find((a) => a.id === activeId);

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-[calc(100vh-10rem)] overflow-x-auto">
          {COLUMNS.map((col) => {
            const items = applications.filter((a) => a.status === col.id);
            return (
              <KanbanColumn key={col.id} id={col.id} label={col.label} count={items.length}>
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-1">
                    {items.map((app) => (
                      <KanbanCard
                        key={app.id}
                        application={app}
                        onClick={() => setSelectedApp(app)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeApp && (
            <Card className="w-64 cursor-grabbing shadow-xl border-primary/30 rotate-2">
              <CardContent className="p-3">
                <p className="font-semibold text-sm">{activeApp.company}</p>
                <p className="text-xs text-muted-foreground">
                  {activeApp.role}
                </p>
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

      <ApplicationSheet
        application={selectedApp}
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
      />
    </>
  );
}
