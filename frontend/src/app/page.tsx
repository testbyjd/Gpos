"use client";

import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { PosRegister } from "@/features/pos/PosRegister";

export default function Home() {
  const [user] = useState(getStoredUser);

  useEffect(() => {
    if (!user) {
      // Nginx redirects /login → /pos/login.
      window.location.replace("/login");
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm font-semibold text-muted-foreground">
        Checking session...
      </div>
    );
  }

  return <PosRegister />;
}
