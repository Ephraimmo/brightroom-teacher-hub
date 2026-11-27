import { useInfiniteQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { FormField } from "@/components/design/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actionLabel, auditActor, auditDetails, auditWhen, AUDIT_GROUPS } from "@/domain/audit";
import { looksLikeEmail, ROLE_CHANGE_MESSAGES, roleChangeProblem } from "@/domain/role-assignment";
import { AUDIT_PAGE_SIZE, loadAuditPage } from "@/lib/admin-audit";
import { findUserByEmail } from "@/lib/admin-people";

type PersonFilter = { email: string; userId: string } | null;

/**
 * Admin → Audit log: every recorded change, newest first. Read-only: nobody,
 * not even a platform admin, can change or delete entries.
 */
export function AuditPage() {
  const [group, setGroup] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [person, setPerson] = useState<PersonFilter>(null);
  const [personError, setPersonError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const log = useInfiniteQuery({
    queryKey: ["admin-audit", group, person?.userId ?? null],
    initialPageParam: null as number | null,
    retry: false,
    queryFn: ({ pageParam }) =>
      loadAuditPage({ group, userId: person?.userId ?? null, beforeId: pageParam }),
    getNextPageParam: (last) =>
      last.length < AUDIT_PAGE_SIZE ? undefined : (last[last.length - 1]?.id ?? undefined),
  });
  const entries = log.data?.pages.flat() ?? [];

  async function applyPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailInput.trim()) {
      setPerson(null);
      setPersonError(null);
      return;
    }
    if (!looksLikeEmail(emailInput)) {
      setPersonError("Enter the person's full email address.");
      return;
    }
    setLooking(true);
    try {
      const found = await findUserByEmail(emailInput);
      if (!found) {
        setPersonError("No account uses that email.");
        return;
      }
      setPersonError(null);
      setPerson({ email: found.email, userId: found.userId });
    } catch (error) {
      setPersonError(ROLE_CHANGE_MESSAGES[roleChangeProblem(error)]);
    } finally {
      setLooking(false);
    }
  }

  return (
    <AppShell
      role="platform_admin"
      eyebrow="PLATFORM ADMINISTRATION"
      title="Audit log"
      description="Every recorded change: who made it, what changed, when and why. Entries can't be edited or deleted."
    >
      <section className="workspace-panel audit-filters" aria-label="Filter the audit log">
        <FormField id="audit-group" label="Type of change">
          <select
            className="native-select"
            value={group}
            onChange={(e) => setGroup(e.currentTarget.value)}
          >
            {AUDIT_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </FormField>
        <form className="audit-person" onSubmit={(e) => void applyPerson(e)} noValidate>
          <FormField
            id="audit-person"
            label="Person (email)"
            hint="Changes they made or that affected them. Leave empty for everyone."
            error={personError}
          >
            <Input
              type="email"
              autoComplete="off"
              value={emailInput}
              onChange={(e) => setEmailInput(e.currentTarget.value)}
            />
          </FormField>
          <Button type="submit" variant="outline" disabled={looking}>
            {looking ? "Looking up…" : "Filter"}
          </Button>
          {person ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPerson(null);
                setEmailInput("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>
      </section>

      {log.isLoading ? (
        <LoadingState label="Loading the audit log…" rows={5} />
      ) : log.isError ? (
        <ErrorState
          title="The audit log didn't load"
          description={ROLE_CHANGE_MESSAGES[roleChangeProblem(log.error)]}
          onRetry={() => void log.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No changes recorded"
          description={
            person || group
              ? "Nothing matches these filters."
              : "Changes to roles, account status and profiles will appear here."
          }
        />
      ) : (
        <section className="workspace-panel audit-panel">
          <div className="audit-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Affected</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const details = auditDetails(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {auditWhen(entry.occurredAt)}
                      </TableCell>
                      <TableCell>
                        <strong>{actionLabel(entry.action)}</strong>
                        {details ? <span className="audit-details">{details}</span> : null}
                      </TableCell>
                      <TableCell>{entry.targetEmail ?? "Deleted account"}</TableCell>
                      <TableCell>{auditActor(entry)}</TableCell>
                      <TableCell>{entry.reason ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {log.hasNextPage ? (
            <Button
              variant="outline"
              disabled={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              {log.isFetchingNextPage ? "Loading…" : "Show older changes"}
            </Button>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
