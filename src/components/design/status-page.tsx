import { AlertTriangle, Compass, Hourglass, Loader2, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StatusPageKind = "loading" | "not-found" | "error" | "forbidden" | "pending";

const icons: Record<StatusPageKind, LucideIcon> = {
  loading: Loader2,
  "not-found": Compass,
  error: AlertTriangle,
  forbidden: Lock,
  pending: Hourglass,
};

/**
 * Full-page message used outside the workspace frame: checking the account,
 * page not found, something failed, no access, or waiting for a role.
 */
export function StatusPage({
  kind,
  title,
  description,
  actions,
  code,
}: {
  kind: StatusPageKind;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Large label above the title, e.g. "404". */
  code?: string;
}) {
  const Icon = icons[kind];
  const isLoading = kind === "loading";

  return (
    <main className="status-page" data-kind={kind}>
      <div
        className="status-page-body"
        role={isLoading ? "status" : kind === "error" ? "alert" : undefined}
        aria-live={isLoading ? "polite" : undefined}
      >
        <span className="status-page-icon">
          <Icon aria-hidden="true" className={isLoading ? "animate-spin" : undefined} />
        </span>
        {code ? <p className="status-page-code">{code}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="status-page-description">{description}</p> : null}
        {actions ? <div className="status-page-actions">{actions}</div> : null}
      </div>
    </main>
  );
}
