"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseTillModal } from "./CloseTillModal";

export function CloseTillButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Lock className="h-4 w-4" />
        Close till
      </Button>
      {open && <CloseTillModal onClose={() => setOpen(false)} />}
    </>
  );
}
