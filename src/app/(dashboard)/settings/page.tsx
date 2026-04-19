"use client";

import { useSession, signIn } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, RefreshCw, Clock, Shield } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and sync preferences
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Connected Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-11 w-11 rounded-full ring-2 ring-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{session.user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                  Connected
                </Badge>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <Label className="text-sm font-medium">Gmail Access</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Read-only access to your Gmail for scanning job application
                    emails. We never modify or delete your emails.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Not signed in</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Sync Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <Label className="text-sm font-medium">Sync Frequency</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Currently set to <strong>manual</strong>. Use the &ldquo;Sync
                Gmail&rdquo; button on the Dashboard to trigger a sync.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <Label className="text-sm font-medium">Re-connect Gmail</Label>
              <p className="text-sm text-muted-foreground mt-0.5 mb-3">
                If you&apos;re having issues with Gmail sync, try re-connecting your
                account.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  signIn.social({
                    provider: "google",
                    callbackURL: "/settings",
                  })
                }
              >
                Re-connect Google Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
