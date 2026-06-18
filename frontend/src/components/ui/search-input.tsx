import { type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Accessible name — also used as the visual placeholder unless overridden. */
  label: string;
  containerClassName?: string;
}

export function SearchInput({
  label,
  placeholder,
  className,
  containerClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25",
          className,
        )}
        {...props}
      />
    </div>
  );
}
