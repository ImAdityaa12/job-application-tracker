"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Inbox,
  Settings,
  LogOut,
  Briefcase,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Briefcase className="h-4 w-4 text-primary-foreground" />
        </div>
        <h1 className="text-base font-bold tracking-tight">Job Tracker</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
