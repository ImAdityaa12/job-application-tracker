"use client";

import { useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Interview {
  id: string;
  applicationId: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  outcome: string | null;
}

interface Application {
  id: string;
  company: string;
  role: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  interview: Interview;
  company: string;
  role: string;
}

export function InterviewCalendar() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: () => fetch("/api/applications").then((r) => r.json()),
  });

  const { data: allInterviews = [] } = useQuery<Interview[]>({
    queryKey: ["all-interviews"],
    queryFn: async () => {
      const results: Interview[] = [];
      for (const app of applications) {
        const res = await fetch(`/api/applications/${app.id}/interviews`);
        const data = await res.json();
        results.push(...data);
      }
      return results;
    },
    enabled: applications.length > 0,
  });

  const events = useMemo<CalendarEvent[]>(() => {
    return allInterviews.map((interview) => {
      const app = applications.find((a) => a.id === interview.applicationId);
      const start = new Date(interview.scheduledAt);
      const end = new Date(
        start.getTime() + (interview.durationMinutes || 60) * 60 * 1000
      );

      return {
        id: interview.id,
        title: `${app?.company || "Unknown"} - ${interview.type.replace("_", " ")}`,
        start,
        end,
        interview,
        company: app?.company || "Unknown",
        role: app?.role || "",
      };
    });
  }, [allInterviews, applications]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  return (
    <>
      <div className="h-[calc(100vh-10rem)]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          onSelectEvent={handleSelectEvent}
          style={{ height: "100%" }}
        />
      </div>

      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.company}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {selectedEvent.role}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="capitalize">
                    {selectedEvent.interview.type.replace("_", " ")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {selectedEvent.start.toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  {selectedEvent.interview.durationMinutes} min
                </div>
                <div>
                  <span className="text-muted-foreground">Outcome:</span>{" "}
                  <Badge variant="secondary">
                    {selectedEvent.interview.outcome || "pending"}
                  </Badge>
                </div>
              </div>
              {selectedEvent.interview.location && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Location:</span>{" "}
                  {selectedEvent.interview.location}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
