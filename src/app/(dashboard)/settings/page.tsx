"use client";

import { useSession, signIn } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Connected Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium">{session.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  Connected
                </Badge>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Gmail Access</Label>
                <p className="text-sm mt-1">
                  Read-only access to your Gmail for scanning job application
                  emails.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Not signed in</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Sync Frequency</Label>
            <p className="text-sm mt-1">
              Currently set to <strong>manual</strong>. Use the &ldquo;Sync
              Gmail&rdquo; button on the Dashboard to trigger a sync.
            </p>
          </div>
          <Separator />
          <div>
            <Label className="text-muted-foreground">Re-connect Gmail</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
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
        </CardContent>
      </Card>
    </div>
  );
}
