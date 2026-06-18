import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PagePanel } from "@/features/admin/components/AdminShell";

type Tone = "primary" | "warning" | "success" | "accent" | "danger";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary ring-primary/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  success: "bg-success/10 text-success ring-success/20",
  accent: "bg-accent/10 text-accent ring-accent/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** Extra content rendered below the value (e.g. a small sub-grid). */
  children?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  children,
  className,
}: StatCardProps) {
  return (
    <PagePanel className={cn("card-lift p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg ring-1",
              toneClasses[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {children}
    </PagePanel>
  );
}
