import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { School } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill, type StatusTone } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reasonProblem, ROLE_CHANGE_MESSAGES, roleChangeProblem } from "@/domain/role-assignment";
import {
  DUPLICATE_EMIS_MESSAGE,
  INSTITUTION_STATUS_LABELS,
  INSTITUTION_TYPES,
  PROVINCES,
  provinceName,
  SCHOOL_FIELD_MESSAGES,
  schoolFieldForError,
  validateSchool,
  type InstitutionStatus,
  type InstitutionType,
  type ProvinceCode,
  type SchoolErrors,
  type SchoolForm,
} from "@/domain/schools";
import {
  listInstitutions,
  registerInstitution,
  setInstitutionStatus,
  type Institution,
} from "@/lib/schools";

const STATUS_TONES: Record<InstitutionStatus, StatusTone> = {
  pending: "info",
  active: "success",
  suspended: "warning",
  closed: "danger",
};

const NEXT_STATUS: Record<InstitutionStatus, { to: InstitutionStatus; label: string }[]> = {
  pending: [{ to: "active", label: "Approve" }],
  active: [
    { to: "suspended", label: "Suspend" },
    { to: "closed", label: "Close" },
  ],
  suspended: [
    { to: "active", label: "Reactivate" },
    { to: "closed", label: "Close" },
  ],
  closed: [{ to: "active", label: "Reactivate" }],
};

const EMPTY: SchoolForm = {
  name: "",
  type: "school",
  province: "",
  emisNumber: "",
  contactEmail: "",
  contactPhone: "",
  firstAdminEmail: "",
};

/** Admin → Schools: register schools and change their status. */
export function SchoolsPage() {
  const schools = useQuery({
    queryKey: ["admin-schools"],
    retry: false,
    queryFn: listInstitutions,
  });
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <AppShell
      role="platform_admin"
      eyebrow="PLATFORM ADMINISTRATION"
      title="Schools"
      description="Register schools and manage their status. Each school's records are kept separate from every other school's."
      actions={
        registering ? null : (
          <Button
            onClick={() => {
              setNotice(null);
              setRegistering(true);
            }}
          >
            Register a school
          </Button>
        )
      }
    >
      {notice ? (
        <p className="form-message form-message--success" role="status">
          {notice}
        </p>
      ) : null}
      {registering ? (
        <RegisterSchool
          onDone={(name, adminEmail) => {
            setRegistering(false);
            setNotice(
              `${name} is registered. ${adminEmail} can now sign up (or sign in) with that email and accept the invitation to run the school's account.`,
            );
          }}
          onCancel={() => setRegistering(false)}
        />
      ) : null}

      {schools.isLoading ? (
        <LoadingState label="Loading schools…" rows={3} />
      ) : schools.isError ? (
        <ErrorState
          title="Schools didn't load"
          description={ROLE_CHANGE_MESSAGES[roleChangeProblem(schools.error)]}
          onRetry={() => void schools.refetch()}
        />
      ) : (schools.data ?? []).length === 0 ? (
        <EmptyState
          icon={School}
          title="No schools yet"
          description="Register the first school to invite its administrator."
        />
      ) : (
        <ul className="school-list">
          {(schools.data ?? []).map((school) => (
            <SchoolRow key={school.id} school={school} />
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function RegisterSchool({
  onDone,
  onCancel,
}: {
  onDone: (name: string, adminEmail: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SchoolForm>(EMPTY);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<SchoolErrors & { reason?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = <K extends keyof SchoolForm>(key: K, value: SchoolForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const register = useMutation({
    mutationFn: () => registerInstitution(form, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-schools"] });
      onDone(form.name.trim(), form.firstAdminEmail.trim().toLowerCase());
    },
    onError: (error) => {
      const field = schoolFieldForError(error);
      if (field) {
        setErrors({
          [field]:
            (error as { code?: string }).code === "23505"
              ? DUPLICATE_EMIS_MESSAGE
              : SCHOOL_FIELD_MESSAGES[field],
        });
      } else {
        setFailure(ROLE_CHANGE_MESSAGES[roleChangeProblem(error)]);
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const problems: SchoolErrors & { reason?: string } = validateSchool(form);
    const reasonError = reasonProblem(reason);
    if (reasonError) problems.reason = reasonError;
    setErrors(problems);
    if (Object.keys(problems).length === 0) register.mutate();
  }

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader eyebrow="NEW SCHOOL" title="Register a school" />
      <form className="school-form" onSubmit={submit} noValidate>
        <FormField id="school-name" label="School name" error={errors.name} required>
          <Input
            value={form.name}
            maxLength={150}
            onChange={(e) => set("name", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="school-type" label="Kind of institution">
          <select
            className="native-select"
            value={form.type}
            onChange={(e) => set("type", e.currentTarget.value as InstitutionType)}
          >
            {INSTITUTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="school-province" label="Province" error={errors.province} required>
          <select
            className="native-select"
            value={form.province}
            onChange={(e) => set("province", e.currentTarget.value as ProvinceCode | "")}
          >
            <option value="">Choose a province…</option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="school-emis"
          label="EMIS number"
          hint="The Department of Basic Education's school number, if it has one."
          error={errors.emisNumber}
        >
          <Input
            inputMode="numeric"
            value={form.emisNumber}
            onChange={(e) => set("emisNumber", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="school-email" label="School office email" error={errors.contactEmail}>
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="school-phone" label="School office phone" error={errors.contactPhone}>
          <Input
            type="tel"
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.currentTarget.value)}
          />
        </FormField>
        <FormField
          id="school-admin-email"
          label="First school administrator's email"
          hint="They'll be invited to run this school's account. They must sign in with this exact email."
          error={errors.firstAdminEmail}
          required
        >
          <Input
            type="email"
            value={form.firstAdminEmail}
            onChange={(e) => set("firstAdminEmail", e.currentTarget.value)}
          />
        </FormField>
        <FormField
          id="school-reason"
          label="Reason"
          hint="For example, the agreement or request this is based on. Saved in the audit log."
          error={errors.reason}
          required
        >
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        </FormField>
        {failure ? (
          <p className="form-message form-message--error" role="alert">
            {failure}
          </p>
        ) : null}
        <span className="people-confirm">
          <Button type="submit" disabled={register.isPending}>
            {register.isPending ? "Registering…" : "Register school"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </span>
      </form>
    </section>
  );
}

function SchoolRow({ school }: { school: Institution }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ to: InstitutionStatus; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const change = useMutation({
    mutationFn: (to: InstitutionStatus) => setInstitutionStatus(school.id, to, reason),
    onSuccess: (_changed, to) => {
      setPending(null);
      setReason("");
      setMessage({
        ok: true,
        text: `${school.name} is now ${INSTITUTION_STATUS_LABELS[to].toLowerCase()}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-schools"] });
    },
    onError: (error) =>
      setMessage({ ok: false, text: ROLE_CHANGE_MESSAGES[roleChangeProblem(error)] }),
  });

  return (
    <li className="workspace-panel school-row">
      <div className="school-row-main">
        <div>
          <h2>{school.name}</h2>
          <p className="people-note">
            {[
              INSTITUTION_TYPES.find((t) => t.value === school.type)?.label,
              provinceName(school.province),
              school.emisNumber ? `EMIS ${school.emisNumber}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusPill tone={STATUS_TONES[school.status]}>
          {INSTITUTION_STATUS_LABELS[school.status]}
        </StatusPill>
        <span className="people-confirm">
          {NEXT_STATUS[school.status].map((next) => (
            <Button
              key={next.to}
              size="sm"
              variant="ghost"
              onClick={() => {
                setMessage(null);
                setPending(next);
              }}
            >
              {next.label}
            </Button>
          ))}
        </span>
      </div>
      {pending ? (
        <div
          className="people-confirm-panel"
          role="group"
          aria-label={`${pending.label} ${school.name}`}
        >
          <p>
            <strong>
              {pending.label} {school.name}?
            </strong>{" "}
            {pending.to === "active"
              ? "Its staff get their access back."
              : "Its staff lose access to the school's records until it's reactivated. Nothing is deleted."}
          </p>
          <FormField id={`school-status-reason-${school.id}`} label="Reason" required>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          </FormField>
          <span className="people-confirm">
            <Button
              size="sm"
              variant={pending.to === "active" ? "default" : "destructive"}
              disabled={change.isPending}
              onClick={() => {
                const problem = reasonProblem(reason);
                if (problem) {
                  setMessage({ ok: false, text: problem });
                  return;
                }
                change.mutate(pending.to);
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
      {message ? (
        <p
          className={`form-message ${message.ok ? "form-message--success" : "form-message--error"}`}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
