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
import { MapPin, Clock, CalendarDays } from "lucide-react";
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

const typeColors: Record<string, { bg: string; border: string }> = {
  phone_screen: { bg: "#DBEAFE", border: "#3B82F6" },
  technical: { bg: "#D1FAE5", border: "#10B981" },
  hr: { bg: "#EDE9FE", border: "#8B5CF6" },
  assignment: { bg: "#FEF3C7", border: "#F59E0B" },
  final: { bg: "#FCE7F3", border: "#EC4899" },
  offer_call: { bg: "#CCFBF1", border: "#14B8A6" },
};

const outcomeColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

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

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = typeColors[event.interview.type] || { bg: "#F3F4F6", border: "#9CA3AF" };
    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: "#1E293B",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 500,
        padding: "2px 6px",
      },
    };
  }, []);

  return (
    <>
      <div className="h-[calc(100vh-10rem)] calendar-themed">
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
          eventPropGetter={eventStyleGetter}
          style={{ height: "100%" }}
        />
      </div>

      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedEvent?.company}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedEvent?.role}
            </p>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium text-sm capitalize mt-0.5">
                    {selectedEvent.interview.type.replace("_", " ")}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Date
                  </span>
                  <p className="font-medium text-sm mt-0.5">
                    {selectedEvent.start.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Duration
                  </span>
                  <p className="font-medium text-sm mt-0.5">
                    {selectedEvent.interview.durationMinutes} min
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground">Outcome</span>
                  <Badge
                    variant="outline"
                    className={`mt-1 block w-fit text-xs border ${
                      outcomeColors[selectedEvent.interview.outcome || "pending"] || ""
                    }`}
                  >
                    {selectedEvent.interview.outcome || "pending"}
                  </Badge>
                </div>
              </div>
              {selectedEvent.interview.location && (
                <div className="rounded-lg border p-3 text-sm">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location
                  </span>
                  <p className="font-medium mt-0.5">{selectedEvent.interview.location}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
