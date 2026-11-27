import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailOpen } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_ROLE_LABELS } from "@/domain/schools";
import { claimGuardianRecord, myGuardianInvitations } from "@/lib/guardians";
import { acceptInvitation, myInvitations } from "@/lib/schools";

const invitationsKey = (userId: string | undefined) =>
  ["my-invitations", userId ?? "signed-out"] as const;

/**
 * Invitations to join a school, for the signed-in person's email.
 * Shows nothing when there are none.
 */
export function InvitationsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: invitationsKey(user?.id),
    enabled: Boolean(user),
    queryFn: myInvitations,
  });

  const parentInvitations = useQuery({
    queryKey: ["my-guardian-invitations", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: myGuardianInvitations,
  });

  const accept = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "staff" | "parent" }) =>
      kind === "parent" ? claimGuardianRecord(id) : acceptInvitation(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: invitationsKey(user?.id) });
      await queryClient.invalidateQueries({ queryKey: ["my-guardian-invitations"] });
      // The new role opens a new area in the menu.
      await queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["my-schools"] });
    },
    onError: () =>
      setError("This invitation can't be used any more. Ask the school to invite you again."),
  });

  const list = invitations.data ?? [];
  const parentList = parentInvitations.data ?? [];
  if (list.length === 0 && parentList.length === 0) return null;

  return (
    <section className="invitations-panel" aria-label="Invitations">
      {list.map((inv) => (
        <div key={inv.id} className="invitation">
          <MailOpen aria-hidden="true" />
          <p>
            <strong>{inv.institutionName}</strong> invited you to join as{" "}
            {MEMBERSHIP_ROLE_LABELS[inv.role].toLowerCase()}
            {inv.title ? ` (${inv.title})` : ""}.
            <span className="people-note">
              {" "}
              Open until {new Date(inv.expiresAt).toLocaleDateString("en-ZA")}.
            </span>
          </p>
          <Button
            size="sm"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ id: inv.id, kind: "staff" })}
          >
            Accept
          </Button>
        </div>
      ))}
      {parentList.map((inv) => (
        <div key={inv.id} className="invitation">
          <MailOpen aria-hidden="true" />
          <p>
            <strong>{inv.institutionName}</strong> has you as a parent or guardian. Confirm it's you
            to see your children's information.
          </p>
          <Button
            size="sm"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ id: inv.id, kind: "parent" })}
          >
            Confirm
          </Button>
        </div>
      ))}
      {error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
