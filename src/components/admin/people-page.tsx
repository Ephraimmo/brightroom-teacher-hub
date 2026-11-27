import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchX, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/app-shell/app-shell";
import { SectionHeader } from "@/components/design/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { FormField } from "@/components/design/form-field";
import { StatusPill } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformRole } from "@/domain/permissions";
import {
  canRemoveRole,
  looksLikeEmail,
  MAX_REASON_LENGTH,
  normalizeEmail,
  reasonProblem,
  ROLE_CHANGE_MESSAGES,
  ROLE_NAMES,
  roleChangeProblem,
  rolesToOffer,
} from "@/domain/role-assignment";
import { findUserByEmail, grantRole, revokeRole, type FoundUser } from "@/lib/admin-people";

/**
 * Admin → People: find one account by its exact email and give or remove
 * roles, with a reason that goes into the audit log.
 */
export function PeoplePage() {
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);

  const search = useQuery({
    queryKey: ["admin-find-user", searched],
    enabled: searched !== null,
    retry: false,
    queryFn: () => findUserByEmail(searched ?? ""),
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!looksLikeEmail(emailInput)) {
      setEmailError("Enter the person's full email address, for example name@school.co.za.");
      return;
    }
    setEmailError(null);
    setSearched(normalizeEmail(emailInput));
  }

  return (
    <AppShell
      role="platform_admin"
      eyebrow="PLATFORM ADMINISTRATION"
      title="People"
      description="Find an account by email and choose what it can access. Every change is recorded with your reason."
    >
      <section className="workspace-panel people-panel">
        <SectionHeader eyebrow="FIND AN ACCOUNT" title="Search by email" />
        <form className="people-search" onSubmit={handleSearch} noValidate>
          <FormField
            id="people-email"
            label="Email address"
            hint="Use the exact address the person signed up with."
            error={emailError}
          >
            <Input
              type="email"
              autoComplete="off"
              value={emailInput}
              onChange={(e) => setEmailInput(e.currentTarget.value)}
            />
          </FormField>
          <Button type="submit">Find account</Button>
        </form>
      </section>

      {searched === null ? null : search.isLoading ? (
        <LoadingState label="Looking up the account…" rows={2} />
      ) : search.isError ? (
        <ErrorState
          title="We couldn't search"
          description={ROLE_CHANGE_MESSAGES[roleChangeProblem(search.error)]}
          onRetry={() => void search.refetch()}
        />
      ) : search.data ? (
        <PersonCard key={search.data.userId} person={search.data} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="No account uses that email"
          description="Check the spelling. The person needs to create an account before you can give them a role."
        />
      )}
    </AppShell>
  );
}

type Change = { kind: "grant" | "revoke"; role: PlatformRole };

function PersonCard({ person }: { person: FoundUser }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const offer = rolesToOffer(person.roles);
  const [roleToAdd, setRoleToAdd] = useState<PlatformRole | "">("");
  const [confirmRemove, setConfirmRemove] = useState<PlatformRole | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const name = person.fullName || person.email;

  const change = useMutation({
    mutationFn: ({ kind, role }: Change) =>
      (kind === "grant" ? grantRole : revokeRole)({ userId: person.userId, role, reason }),
    onSuccess: (changed, { kind, role }) => {
      const roleName = ROLE_NAMES[role];
      const text = !changed
        ? kind === "grant"
          ? `${name} already has the ${roleName} role.`
          : `${name} doesn't have the ${roleName} role.`
        : kind === "grant"
          ? `${name} is now a ${roleName}.`
          : `${name} is no longer a ${roleName}.`;
      setResult({ ok: true, text });
      setReason("");
      setRoleToAdd("");
      setConfirmRemove(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-find-user"] });
      // If admins changed their own roles, their menu and role switcher update too.
      void queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (error) => {
      setResult({ ok: false, text: ROLE_CHANGE_MESSAGES[roleChangeProblem(error)] });
    },
  });

  function submit(next: Change) {
    const problem = reasonProblem(reason);
    setReasonError(problem);
    if (problem) return;
    setResult(null);
    change.mutate(next);
  }

  return (
    <section className="workspace-panel people-panel" aria-labelledby="person-name">
      <div className="person-summary">
        <UserRound aria-hidden="true" />
        <div>
          <h2 id="person-name">{name}</h2>
          <p>{person.email}</p>
        </div>
      </div>

      <h3 className="people-subheading">Current roles</h3>
      {person.roles.length === 0 ? (
        <p className="people-note">
          No roles yet. This person can sign in but can't open any area.
        </p>
      ) : (
        <ul className="people-roles">
          {person.roles.map((role) => (
            <li key={role}>
              <StatusPill tone="info">{ROLE_NAMES[role]}</StatusPill>
              {!user || !canRemoveRole(user.id, person.userId, role) ? (
                <span className="people-note">You can't remove your own administrator role.</span>
              ) : confirmRemove === role ? (
                <span className="people-confirm">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={change.isPending}
                    onClick={() => submit({ kind: "revoke", role })}
                  >
                    Confirm removal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remove ${ROLE_NAMES[role]} role`}
                  onClick={() => {
                    setResult(null);
                    setConfirmRemove(role);
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="people-change">
        <FormField
          id="people-reason"
          label="Reason for the change"
          hint="Required for adding or removing a role. Saved in the audit log."
          error={reasonError}
          required
        >
          <Textarea
            rows={2}
            maxLength={MAX_REASON_LENGTH}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        </FormField>

        {offer.length > 0 ? (
          <div className="people-add">
            <FormField id="people-role" label="Add a role">
              <select
                className="native-select"
                value={roleToAdd}
                onChange={(e) => setRoleToAdd(e.currentTarget.value as PlatformRole | "")}
              >
                <option value="">Choose a role…</option>
                {offer.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_NAMES[role]}
                  </option>
                ))}
              </select>
            </FormField>
            <Button
              disabled={roleToAdd === "" || change.isPending}
              onClick={() => roleToAdd && submit({ kind: "grant", role: roleToAdd })}
            >
              {change.isPending ? "Saving…" : "Add role"}
            </Button>
          </div>
        ) : null}

        {result ? (
          <p
            className={`form-message ${result.ok ? "form-message--success" : "form-message--error"}`}
            role={result.ok ? "status" : "alert"}
          >
            {result.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
