"use client";

import { InterviewCalendar } from "@/components/InterviewCalendar";

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Interview Calendar</h1>
      <InterviewCalendar />
    </div>
  );
}
