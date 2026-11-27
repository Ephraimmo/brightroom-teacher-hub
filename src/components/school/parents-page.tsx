import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_GUARDIAN,
  guardianError,
  matchesSearch,
  RELATIONSHIPS,
  relationshipLabel,
  validateGuardian,
  type GuardianErrors,
  type GuardianForm,
  type Relationship,
} from "@/domain/guardians";
import { formatSaMobile, LANGUAGES, type LanguageCode } from "@/domain/profile";
import { reasonProblem } from "@/domain/role-assignment";
import {
  addGuardian,
  listGuardians,
  setGuardianStatus,
  updateGuardian,
  type Guardian,
} from "@/lib/guardians";

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

const guardiansKey = (id: string) => ["school-guardians", id] as const;

/** School admin → Parents: parent and guardian records and contact choices. */
export function ParentsPage() {
  return (
    <SchoolShell
      title="Parents and guardians"
      description="Contact details are private: only your school's administrators and the parent can see them. Changes are audited."
    >
      {(school) => <ParentsBody institutionId={school.institutionId} />}
    </SchoolShell>
  );
}

function ParentsBody({ institutionId }: { institutionId: string }) {
  const guardians = useQuery({
    queryKey: guardiansKey(institutionId),
    retry: false,
    queryFn: () => listGuardians(institutionId),
  });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const list = (guardians.data ?? []).filter((g) => matchesSearch(g, search));

  return (
    <>
      {notice ? (
        <p className="form-message form-message--success" role="status">
          {notice}
        </p>
      ) : null}
      {adding ? (
        <section className="workspace-panel people-panel">
          <SectionHeader eyebrow="NEW" title="Add a parent or guardian" />
          <GuardianEditor
            institutionId={institutionId}
            onDone={(text) => {
              setAdding(false);
              setNotice(text);
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      ) : (
        <div className="parents-toolbar">
          <FormField id="parents-search" label="Search">
            <Input
              type="search"
              placeholder="Name, email or mobile"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </FormField>
          <Button
            onClick={() => {
              setNotice(null);
              setAdding(true);
            }}
          >
            Add a parent or guardian
          </Button>
        </div>
      )}

      {guardians.isLoading ? (
        <LoadingState label="Loading parents…" rows={3} />
      ) : guardians.isError ? (
        <ErrorState
          title="Parents didn't load"
          description={guardianError(guardians.error).message}
          onRetry={() => void guardians.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No one matches that search" : "No parents or guardians yet"}
          description={
            search
              ? "Check the spelling, or search by mobile number."
              : "Add the parents and guardians of your learners. Learners are linked to them when they're registered."
          }
        />
      ) : (
        <ul className="school-list" aria-label="Parents and guardians">
          {list.map((g) => (
            <GuardianRow key={g.id} guardian={g} institutionId={institutionId} />
          ))}
        </ul>
      )}
    </>
  );
}

function toForm(g: Guardian): GuardianForm {
  return {
    firstName: g.firstName,
    lastName: g.lastName,
    relationship: g.relationship,
    email: g.email ?? "",
    phone: formatSaMobile(g.phone),
    language: g.language,
    contactEmail: g.contactEmail,
    contactSms: g.contactSms,
    contactWhatsapp: g.contactWhatsapp,
  };
}

/** The add/edit form. With `guardian`, edits that record. */
function GuardianEditor({
  institutionId,
  guardian,
  onDone,
  onCancel,
}: {
  institutionId: string;
  guardian?: Guardian;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GuardianForm>(guardian ? toForm(guardian) : EMPTY_GUARDIAN);
  const [errors, setErrors] = useState<GuardianErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = <K extends keyof GuardianForm>(k: K, v: GuardianForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const idPrefix = guardian ? `guardian-${guardian.id}` : "guardian-new";

  const save = useMutation({
    mutationFn: () =>
      guardian
        ? updateGuardian(guardian.id, form)
        : addGuardian(institutionId, form).then(() => true),
    onSuccess: () => {
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`;
      void queryClient.invalidateQueries({ queryKey: guardiansKey(institutionId) });
      onDone(
        guardian
          ? `${name}'s details saved.`
          : form.email.trim()
            ? `${name} added. If they create a LearnBridge account with ${form.email.trim().toLowerCase()}, they can confirm it's them and see their children's information.`
            : `${name} added.`,
      );
    },
    onError: (error) => {
      const { field, message } = guardianError(error);
      if (field) setErrors({ [field]: message });
      else setFailure(message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const problems = validateGuardian(form);
    setErrors(problems);
    if (Object.keys(problems).length === 0) save.mutate();
  }

  return (
    <form className="school-form" onSubmit={submit} noValidate>
      <FormField id={`${idPrefix}-first`} label="First name" error={errors.firstName} required>
        <Input
          value={form.firstName}
          maxLength={80}
          onChange={(e) => set("firstName", e.currentTarget.value)}
        />
      </FormField>
      <FormField id={`${idPrefix}-last`} label="Surname" error={errors.lastName} required>
        <Input
          value={form.lastName}
          maxLength={80}
          onChange={(e) => set("lastName", e.currentTarget.value)}
        />
      </FormField>
      <FormField
        id={`${idPrefix}-relationship`}
        label="Relationship to the learner"
        error={errors.relationship}
        required
      >
        <select
          className="native-select"
          value={form.relationship}
          onChange={(e) => set("relationship", e.currentTarget.value as Relationship | "")}
        >
          <option value="">Choose…</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        id={`${idPrefix}-email`}
        label="Email address"
        hint={guardian?.hasAccount ? "Fixed: they've created their account with it." : undefined}
        error={errors.email}
      >
        <Input
          type="email"
          value={form.email}
          disabled={guardian?.hasAccount === true}
          onChange={(e) => set("email", e.currentTarget.value)}
        />
      </FormField>
      <FormField id={`${idPrefix}-phone`} label="Mobile number" error={errors.phone}>
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.currentTarget.value)}
        />
      </FormField>
      <FormField id={`${idPrefix}-language`} label="Preferred language" error={errors.language}>
        <select
          className="native-select"
          value={form.language}
          onChange={(e) => set("language", e.currentTarget.value as LanguageCode)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </FormField>
      <fieldset
        className="contact-choices"
        aria-describedby={errors.contact ? `${idPrefix}-contact-error` : undefined}
      >
        <legend>How the school may contact them</legend>
        <label>
          <input
            type="checkbox"
            checked={form.contactEmail}
            onChange={(e) => set("contactEmail", e.currentTarget.checked)}
          />
          Email
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.contactSms}
            onChange={(e) => set("contactSms", e.currentTarget.checked)}
          />
          SMS
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.contactWhatsapp}
            onChange={(e) => set("contactWhatsapp", e.currentTarget.checked)}
          />
          WhatsApp
        </label>
        {errors.contact ? (
          <p id={`${idPrefix}-contact-error`} className="form-error">
            {errors.contact}
          </p>
        ) : null}
      </fieldset>
      {failure ? (
        <p className="form-message form-message--error" role="alert">
          {failure}
        </p>
      ) : null}
      <span className="people-confirm">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : guardian ? "Save changes" : "Add"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </span>
    </form>
  );
}

function GuardianRow({ guardian, institutionId }: { guardian: Guardian; institutionId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const name = `${guardian.firstName} ${guardian.lastName}`;
  const archiving = guardian.status === "active";

  const status = useMutation({
    mutationFn: () => setGuardianStatus(guardian.id, archiving ? "archived" : "active", reason),
    onSuccess: () => {
      setConfirming(false);
      setReason("");
      setFeedback({ ok: true, text: archiving ? `${name} archived.` : `${name} restored.` });
      void queryClient.invalidateQueries({ queryKey: guardiansKey(institutionId) });
    },
    onError: (e) => setFeedback({ ok: false, text: guardianError(e).message }),
  });

  const channels = [
    guardian.contactEmail ? "email" : null,
    guardian.contactSms ? "SMS" : null,
    guardian.contactWhatsapp ? "WhatsApp" : null,
  ].filter(Boolean);

  return (
    <li className="workspace-panel school-row" aria-label={name}>
      <div className="school-row-main">
        <div>
          <h2>{name}</h2>
          <p className="people-note">
            {[
              relationshipLabel(guardian.relationship),
              guardian.email,
              guardian.phone ? formatSaMobile(guardian.phone) : null,
              channels.length ? `Contact by ${channels.join(", ")}` : "No contact channels chosen",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {guardian.status === "archived" ? (
          <StatusPill tone="neutral">Archived</StatusPill>
        ) : guardian.hasAccount ? (
          <StatusPill tone="success">Has an account</StatusPill>
        ) : (
          <StatusPill tone="info">No account yet</StatusPill>
        )}
        <span className="people-confirm">
          {guardian.status === "active" ? (
            <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>
              Edit
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFeedback(null);
              setConfirming(true);
            }}
          >
            {archiving ? "Archive" : "Restore"}
          </Button>
        </span>
      </div>
      {editing ? (
        <GuardianEditor
          institutionId={institutionId}
          guardian={guardian}
          onDone={(text) => {
            setEditing(false);
            setFeedback({ ok: true, text });
          }}
          onCancel={() => setEditing(false)}
        />
      ) : null}
      {confirming ? (
        <div
          className="people-confirm-panel"
          role="group"
          aria-label={`${archiving ? "Archive" : "Restore"} ${name}`}
        >
          <p>
            <strong>
              {archiving ? "Archive" : "Restore"} {name}?
            </strong>{" "}
            {archiving
              ? "They're hidden from lists and lose access to their children's information. The record is kept."
              : "Their record becomes active again."}
          </p>
          <FormField id={`guardian-reason-${guardian.id}`} label="Reason" required>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          </FormField>
          <span className="people-confirm">
            <Button
              size="sm"
              variant={archiving ? "destructive" : "default"}
              disabled={status.isPending}
              onClick={() => {
                const problem = reasonProblem(reason);
                if (problem) {
                  setFeedback({ ok: false, text: problem });
                  return;
                }
                status.mutate();
              }}
            >
              Confirm: {archiving ? "archive" : "restore"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </span>
        </div>
      ) : null}
      <FeedbackLine feedback={feedback} />
    </li>
  );
}
