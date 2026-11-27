import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reasonProblem } from "@/domain/role-assignment";
import { isEmail, MEMBERSHIP_ROLE_LABELS, type MembershipRole } from "@/domain/schools";
import {
  STAFF_STATUS_LABELS,
  STAFF_STATUS_TONES,
  staffActions,
  staffErrorMessage,
  type StaffAction,
} from "@/domain/staff";
import { getSchoolSettings, listGradeLevels } from "@/lib/school-settings";
import { createInvitation } from "@/lib/schools";
import {
  listOpenInvitations,
  listStaff,
  revokeInvitation,
  setStaffStatus,
  updateStaffMember,
  type StaffMember,
} from "@/lib/staff";

import { SchoolShell } from "./school-shell";

type Feedback = { ok: boolean; text: string } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      className={`form-message ${feedback.ok ? "form-message--success" : "form-message--error"}`}
      role={feedback.ok ? "status" : "alert"}
    >
      {feedback.text}
    </p>
  );
}

const staffKey = (id: string) => ["school-staff", id] as const;
const invitesKey = (id: string) => ["school-invitations", id] as const;

/** School admin → Staff: invite, edit, suspend and remove teachers and admins. */
export function StaffPage() {
  return (
    <SchoolShell
      title="Staff"
      description="Teachers and administrators at your school. Every change is recorded in the audit log."
    >
      {(school) => <StaffBody institutionId={school.institutionId} />}
    </SchoolShell>
  );
}

function StaffBody({ institutionId }: { institutionId: string }) {
  const staff = useQuery({
    queryKey: staffKey(institutionId),
    retry: false,
    queryFn: () => listStaff(institutionId),
  });
  const grades = useQuery({
    queryKey: ["school-grade-options", institutionId],
    retry: false,
    queryFn: async () => {
      const [settings, levels] = await Promise.all([
        getSchoolSettings(institutionId),
        listGradeLevels(),
      ]);
      return levels.filter((l) => settings.grades.includes(l.code));
    },
  });

  return (
    <>
      <InviteSection institutionId={institutionId} />
      <OpenInvitations institutionId={institutionId} />
      {staff.isLoading ? (
        <LoadingState label="Loading staff…" rows={3} />
      ) : staff.isError ? (
        <ErrorState
          title="Staff didn't load"
          description={staffErrorMessage(staff.error)}
          onRetry={() => void staff.refetch()}
        />
      ) : (staff.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Invite your first teacher above."
        />
      ) : (
        <ul className="school-list" aria-label="Staff">
          {(staff.data ?? []).map((m) => (
            <StaffRow
              key={m.membershipId}
              member={m}
              institutionId={institutionId}
              gradeOptions={grades.data ?? []}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function InviteSection({ institutionId }: { institutionId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("teacher");
  const [title, setTitle] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const invite = useMutation({
    mutationFn: () => createInvitation(institutionId, email, role, title || null),
    onSuccess: () => {
      setFeedback({
        ok: true,
        text: `Invitation ready. Ask them to sign up (or sign in) with ${email.trim().toLowerCase()} and accept it from their profile. It stays open for 14 days.`,
      });
      setEmail("");
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: invitesKey(institutionId) });
    },
    onError: (e) => setFeedback({ ok: false, text: staffErrorMessage(e) }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!isEmail(email)) {
      setEmailError("Enter their email address, for example name@school.co.za.");
      return;
    }
    setEmailError(null);
    invite.mutate();
  }

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader eyebrow="INVITE" title="Invite a staff member" />
      <form className="school-form" onSubmit={submit} noValidate>
        <FormField id="invite-email" label="Email address" error={emailError} required>
          <Input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </FormField>
        <FormField id="invite-role" label="Role">
          <select
            className="native-select"
            value={role}
            onChange={(e) => setRole(e.currentTarget.value as MembershipRole)}
          >
            <option value="teacher">{MEMBERSHIP_ROLE_LABELS.teacher}</option>
            <option value="school_admin">{MEMBERSHIP_ROLE_LABELS.school_admin}</option>
          </select>
        </FormField>
        <FormField id="invite-title" label="Title" hint="Optional, for example HOD Mathematics.">
          <Input value={title} maxLength={80} onChange={(e) => setTitle(e.currentTarget.value)} />
        </FormField>
        <FeedbackLine feedback={feedback} />
        <span className="people-confirm">
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? "Inviting…" : "Invite"}
          </Button>
        </span>
      </form>
    </section>
  );
}

function OpenInvitations({ institutionId }: { institutionId: string }) {
  const queryClient = useQueryClient();
  const invites = useQuery({
    queryKey: invitesKey(institutionId),
    retry: false,
    queryFn: () => listOpenInvitations(institutionId),
  });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const cancel = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      setFeedback({ ok: true, text: "Invitation cancelled." });
      void queryClient.invalidateQueries({ queryKey: invitesKey(institutionId) });
    },
    onError: (e) => setFeedback({ ok: false, text: staffErrorMessage(e) }),
  });

  const list = invites.data ?? [];
  if (list.length === 0 && !feedback) return null;
  return (
    <section className="workspace-panel people-panel" aria-label="Open invitations">
      <SectionHeader eyebrow="WAITING" title="Open invitations" />
      <ul className="security-factors">
        {list.map((inv) => (
          <li key={inv.id}>
            <span>
              <strong>{inv.email}</strong>
              <span className="people-note">
                {" "}
                {MEMBERSHIP_ROLE_LABELS[inv.role]}
                {inv.title ? `, ${inv.title}` : ""} · open until{" "}
                {new Date(inv.expiresAt).toLocaleDateString("en-ZA")}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Cancel invitation for ${inv.email}`}
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(inv.id)}
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
      <FeedbackLine feedback={feedback} />
    </section>
  );
}

function StaffRow({
  member,
  institutionId,
  gradeOptions,
}: {
  member: StaffMember;
  institutionId: string;
  gradeOptions: { code: string; label: string }[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMe = user?.id === member.userId;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(member.title ?? "");
  const [grades, setGrades] = useState<string[]>(member.grades);
  const [pending, setPending] = useState<StaffAction | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const name = member.fullName || member.email;
  const refresh = () => queryClient.invalidateQueries({ queryKey: staffKey(institutionId) });

  const save = useMutation({
    mutationFn: () => updateStaffMember(member.membershipId, title, grades),
    onSuccess: () => {
      setEditing(false);
      setFeedback({ ok: true, text: `${name}'s details saved.` });
      void refresh();
    },
    onError: (e) => setFeedback({ ok: false, text: staffErrorMessage(e) }),
  });
  const status = useMutation({
    mutationFn: (to: StaffAction["to"]) => setStaffStatus(member.membershipId, to, reason),
    onSuccess: (_c, to) => {
      setPending(null);
      setReason("");
      setFeedback({ ok: true, text: `${name} is now ${STAFF_STATUS_LABELS[to].toLowerCase()}.` });
      void refresh();
    },
    onError: (e) => setFeedback({ ok: false, text: staffErrorMessage(e) }),
  });

  const gradeLabel = (code: string) => gradeOptions.find((g) => g.code === code)?.label ?? code;

  return (
    <li className="workspace-panel school-row" aria-label={name}>
      <div className="school-row-main">
        <div>
          <h2>{name}</h2>
          <p className="people-note">
            {[
              member.email,
              MEMBERSHIP_ROLE_LABELS[member.role],
              member.title,
              member.grades.length > 0 ? member.grades.map(gradeLabel).join(", ") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusPill tone={STAFF_STATUS_TONES[member.status]}>
          {STAFF_STATUS_LABELS[member.status]}
        </StatusPill>
        {isMe ? (
          <span className="people-note">This is you.</span>
        ) : (
          <span className="people-confirm">
            <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>
              Edit
            </Button>
            {staffActions(member.status).map((a) => (
              <Button
                key={a.to}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFeedback(null);
                  setPending(a);
                }}
              >
                {a.label}
              </Button>
            ))}
          </span>
        )}
      </div>

      {editing ? (
        <div className="people-confirm-panel" role="group" aria-label={`Edit ${name}`}>
          <FormField id={`staff-title-${member.membershipId}`} label="Title">
            <Input value={title} maxLength={80} onChange={(e) => setTitle(e.currentTarget.value)} />
          </FormField>
          {member.role === "teacher" ? (
            gradeOptions.length === 0 ? (
              <p className="people-note">Choose the grades your school offers in Settings first.</p>
            ) : (
              <fieldset className="grade-grid">
                <legend className="people-subheading">Grades they teach</legend>
                {gradeOptions.map((g) => (
                  <label key={g.code} className="settings-check">
                    <input
                      type="checkbox"
                      checked={grades.includes(g.code)}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setGrades((c) => (on ? [...c, g.code] : c.filter((x) => x !== g.code)));
                      }}
                    />
                    {g.label}
                  </label>
                ))}
              </fieldset>
            )
          ) : null}
          <span className="people-confirm">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </span>
        </div>
      ) : null}

      {pending ? (
        <div className="people-confirm-panel" role="group" aria-label={`${pending.label} ${name}`}>
          <p>
            <strong>
              {pending.label} {name}?
            </strong>{" "}
            {pending.explanation}
          </p>
          <FormField id={`staff-reason-${member.membershipId}`} label="Reason" required>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          </FormField>
          <span className="people-confirm">
            <Button
              size="sm"
              variant={pending.to === "active" ? "default" : "destructive"}
              disabled={status.isPending}
              onClick={() => {
                const problem = reasonProblem(reason);
                if (problem) {
                  setFeedback({ ok: false, text: problem });
                  return;
                }
                status.mutate(pending.to);
              }}
            >
              Confirm: {pending.label.toLowerCase()}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </span>
        </div>
      ) : null}
      <FeedbackLine feedback={feedback} />
    </li>
  );
}
