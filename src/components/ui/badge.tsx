import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "ok" | "live" | "danger";
  children: ReactNode;
}) {
  const tones = {
    muted: "text-muted border-border",
    ok: "text-ok border-ok/30",
    live: "text-live border-live/30",
    danger: "text-danger border-danger/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
