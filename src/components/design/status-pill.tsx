import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "info" | "danger";

/**
 * Small coloured label for a record's state ("Active", "Overdue", "Pending payment").
 * The text always carries the meaning; the colour only reinforces it, so never
 * use an empty pill or rely on colour alone.
 */
export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("status-pill", tone !== "neutral" && `status-pill--${tone}`, className)}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
