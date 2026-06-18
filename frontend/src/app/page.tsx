"use client";

import { useEffect, useState } from "react";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { PosRegister } from "@/features/pos/PosRegister";

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !user) {
      window.location.replace("/login");
    }
  }, [ready, user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm font-semibold text-muted-foreground">
        Checking session...
      </div>
    );
  }

  return <PosRegister />;
}
