import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatDate,
  POLICIES,
  settingsErrorMessage,
  validateTerm,
  validateYear,
  withPolicyDefaults,
  type AcademicYear,
  type Policies,
  type YearForm,
} from "@/domain/school-settings";
import { PROVINCES, SCHOOL_FIELD_MESSAGES, validateSchool } from "@/domain/schools";
import {
  getSchoolSettings,
  listGradeLevels,
  saveAcademicYear,
  saveTerm,
  setGrades,
  updatePolicies,
  updateSchoolDetails,
  type SchoolDetailsForm,
  type SchoolSettings,
} from "@/lib/school-settings";

import { periodsKey, usePeriodFilter } from "./use-period-filter";
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

/** School admin → Settings: details, academic calendar, grades and policies. */
export function SchoolSettingsPage() {
  return (
    <SchoolShell
      title="School settings"
      description="Your school's details, academic calendar, grades and policies. Changes are recorded in the audit log."
    >
      {(school) => <SettingsBody institutionId={school.institutionId} />}
    </SchoolShell>
  );
}

function SettingsBody({ institutionId }: { institutionId: string }) {
  const settings = useQuery({
    queryKey: ["school-settings", institutionId],
    retry: false,
    queryFn: () => getSchoolSettings(institutionId),
  });

  if (settings.isLoading) return <LoadingState label="Loading settings…" rows={4} />;
  if (settings.isError || !settings.data) {
    return (
      <ErrorState
        title="Settings didn't load"
        description={settingsErrorMessage(settings.error)}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  return (
    <div className="settings-sections">
      <DetailsSection settings={settings.data} />
      <CalendarSection institutionId={institutionId} />
      <GradesSection settings={settings.data} />
      <PoliciesSection settings={settings.data} />
    </div>
  );
}

function DetailsSection({ settings }: { settings: SchoolSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SchoolDetailsForm>({
    name: settings.name,
    emisNumber: settings.emisNumber,
    province: settings.province,
    district: settings.district,
    address: settings.address,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SchoolDetailsForm, string>>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const set = <K extends keyof SchoolDetailsForm>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => updateSchoolDetails(settings.id, form),
    onSuccess: (changed) => {
      setFeedback({ ok: true, text: changed ? "School details saved." : "No changes to save." });
      void queryClient.invalidateQueries({ queryKey: ["school-settings", settings.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-schools"] });
    },
    onError: (error) => setFeedback({ ok: false, text: settingsErrorMessage(error) }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const all = validateSchool({
      ...form,
      type: settings.type,
      province: form.province as never,
      firstAdminEmail: "unused@example.test",
    });
    const problems: typeof errors = {};
    for (const key of ["name", "emisNumber", "province", "contactEmail", "contactPhone"] as const) {
      if (all[key]) problems[key] = all[key];
    }
    if (form.district.length > 100) problems.district = "Keep the district under 100 characters.";
    if (form.address.length > 300) problems.address = "Keep the address under 300 characters.";
    setErrors(problems);
    if (Object.keys(problems).length === 0) save.mutate();
  }

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader eyebrow="SCHOOL DETAILS" title="Details" />
      <form className="school-form" onSubmit={submit} noValidate>
        <FormField id="settings-name" label="School name" error={errors.name} required>
          <Input
            value={form.name}
            maxLength={150}
            onChange={(e) => set("name", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="settings-province" label="Province" error={errors.province} required>
          <select
            className="native-select"
            value={form.province}
            onChange={(e) => set("province", e.currentTarget.value)}
          >
            <option value="">Choose a province…</option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="settings-district" label="District" error={errors.district}>
          <Input
            value={form.district}
            maxLength={100}
            onChange={(e) => set("district", e.currentTarget.value)}
          />
        </FormField>
        <FormField
          id="settings-emis"
          label="EMIS number"
          error={errors.emisNumber}
          hint={SCHOOL_FIELD_MESSAGES.emisNumber}
        >
          <Input
            inputMode="numeric"
            value={form.emisNumber}
            onChange={(e) => set("emisNumber", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="settings-email" label="Office email" error={errors.contactEmail}>
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="settings-phone" label="Office phone" error={errors.contactPhone}>
          <Input
            type="tel"
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.currentTarget.value)}
          />
        </FormField>
        <FormField id="settings-address" label="Street address" error={errors.address}>
          <Input
            value={form.address}
            maxLength={300}
            onChange={(e) => set("address", e.currentTarget.value)}
          />
        </FormField>
        <FeedbackLine feedback={feedback} />
        <span className="people-confirm">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save details"}
          </Button>
        </span>
      </form>
    </section>
  );
}

const EMPTY_YEAR: YearForm = { label: "", startsOn: "", endsOn: "", makeCurrent: true };

function CalendarSection({ institutionId }: { institutionId: string }) {
  const queryClient = useQueryClient();
  const { years, isLoading, error } = usePeriodFilter(institutionId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<YearForm>(EMPTY_YEAR);
  const [errors, setErrors] = useState<ReturnType<typeof validateYear>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: periodsKey(institutionId) });
  const addYear = useMutation({
    mutationFn: () => saveAcademicYear(institutionId, null, form),
    onSuccess: () => {
      setAdding(false);
      setForm(EMPTY_YEAR);
      setFeedback({ ok: true, text: "Academic year added. Now add its terms." });
      void refresh();
    },
    onError: (e) => setFeedback({ ok: false, text: settingsErrorMessage(e) }),
  });
  const makeCurrent = useMutation({
    mutationFn: (y: AcademicYear) =>
      saveAcademicYear(institutionId, y.id, {
        label: y.label,
        startsOn: y.startsOn,
        endsOn: y.endsOn,
        makeCurrent: true,
      }),
    onSuccess: (_id, y) => {
      setFeedback({ ok: true, text: `${y.label} is now the current year.` });
      void refresh();
    },
    onError: (e) => setFeedback({ ok: false, text: settingsErrorMessage(e) }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = validateYear(form, years);
    setErrors(problems);
    if (Object.keys(problems).length === 0) addYear.mutate();
  }

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader
        eyebrow="ACADEMIC CALENDAR"
        title="Years and terms"
        action={
          adding ? null : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              Add a year
            </Button>
          )
        }
      />
      <p className="form-hint">
        Class lists, attendance and reports filter by these years and terms.
      </p>
      {adding ? (
        <form className="school-form" onSubmit={submit} noValidate aria-label="New academic year">
          <FormField
            id="year-label"
            label="Year name"
            hint="For example 2027."
            error={errors.label}
            required
          >
            <Input
              value={form.label}
              maxLength={20}
              onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
            />
          </FormField>
          <FormField id="year-start" label="First day" error={errors.startsOn} required>
            <Input
              type="date"
              value={form.startsOn}
              onChange={(e) => setForm({ ...form, startsOn: e.currentTarget.value })}
            />
          </FormField>
          <FormField id="year-end" label="Last day" error={errors.endsOn} required>
            <Input
              type="date"
              value={form.endsOn}
              onChange={(e) => setForm({ ...form, endsOn: e.currentTarget.value })}
            />
          </FormField>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={form.makeCurrent}
              onChange={(e) => setForm({ ...form, makeCurrent: e.currentTarget.checked })}
            />
            Make this the current year
          </label>
          <span className="people-confirm">
            <Button type="submit" disabled={addYear.isPending}>
              {addYear.isPending ? "Saving…" : "Add year"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </span>
        </form>
      ) : null}
      <FeedbackLine feedback={feedback} />
      {isLoading ? (
        <LoadingState label="Loading the calendar…" rows={2} />
      ) : error ? (
        <p className="form-message form-message--error" role="alert">
          {settingsErrorMessage(error)}
        </p>
      ) : years.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No academic years yet"
          description="Add your first year, then its terms."
        />
      ) : (
        <ul className="year-list">
          {years.map((y) => (
            <li key={y.id} className="year-card">
              <div className="school-row-main">
                <div>
                  <h3>{y.label}</h3>
                  <p className="people-note">
                    {formatDate(y.startsOn)} to {formatDate(y.endsOn)}
                  </p>
                </div>
                {y.isCurrent ? (
                  <StatusPill tone="success">Current year</StatusPill>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={makeCurrent.isPending}
                    onClick={() => makeCurrent.mutate(y)}
                  >
                    Make current
                  </Button>
                )}
              </div>
              <TermsEditor year={y} onSaved={() => void refresh()} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TermsEditor({ year, onSaved }: { year: AcademicYear; onSaved: () => void }) {
  return (
    <div className="term-list">
      {[1, 2, 3, 4].map((n) => (
        <TermRow
          key={`${n}-${year.terms.find((t) => t.number === n)?.startsOn ?? ""}`}
          year={year}
          number={n}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}

function TermRow({
  year,
  number,
  onSaved,
}: {
  year: AcademicYear;
  number: number;
  onSaved: () => void;
}) {
  const existing = year.terms.find((t) => t.number === number);
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? "");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const save = useMutation({
    mutationFn: () => saveTerm(year.id, { number, startsOn, endsOn }),
    onSuccess: () => {
      setFeedback({ ok: true, text: `Term ${number} saved.` });
      onSaved();
    },
    onError: (e) => setFeedback({ ok: false, text: settingsErrorMessage(e) }),
  });

  return (
    <div className="term-row" role="group" aria-label={`${year.label} term ${number}`}>
      <strong>
        Term {number}
        {existing?.isCurrent ? <StatusPill tone="info">Now</StatusPill> : null}
      </strong>
      <FormField id={`term-${year.id}-${number}-start`} label="Starts">
        <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.currentTarget.value)} />
      </FormField>
      <FormField id={`term-${year.id}-${number}-end`} label="Ends">
        <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.currentTarget.value)} />
      </FormField>
      <Button
        size="sm"
        variant="outline"
        disabled={save.isPending}
        onClick={() => {
          const problems = validateTerm({ number, startsOn, endsOn }, year);
          const first = problems.startsOn ?? problems.endsOn;
          if (first) {
            setFeedback({ ok: false, text: first });
            return;
          }
          setFeedback(null);
          save.mutate();
        }}
      >
        {existing ? "Update" : "Save"}
      </Button>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

function GradesSection({ settings }: { settings: SchoolSettings }) {
  const queryClient = useQueryClient();
  const levels = useQuery({ queryKey: ["grade-levels"], retry: false, queryFn: listGradeLevels });
  const [chosen, setChosen] = useState<string[]>(settings.grades);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const save = useMutation({
    mutationFn: () => setGrades(settings.id, chosen),
    onSuccess: () => {
      setFeedback({ ok: true, text: "Grades saved." });
      void queryClient.invalidateQueries({ queryKey: ["school-settings", settings.id] });
    },
    onError: (e) => setFeedback({ ok: false, text: settingsErrorMessage(e) }),
  });

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader eyebrow="GRADES" title="Grades you offer" />
      {levels.isLoading ? (
        <LoadingState label="Loading grades…" rows={1} />
      ) : levels.isError ? (
        <p className="form-message form-message--error" role="alert">
          {settingsErrorMessage(levels.error)}
        </p>
      ) : (
        <fieldset className="grade-grid">
          <legend className="sr-only">Grades offered</legend>
          {(levels.data ?? []).map((g) => (
            <label key={g.code} className="settings-check">
              <input
                type="checkbox"
                checked={chosen.includes(g.code)}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setChosen((c) => (on ? [...c, g.code] : c.filter((x) => x !== g.code)));
                }}
              />
              {g.label}
            </label>
          ))}
        </fieldset>
      )}
      <FeedbackLine feedback={feedback} />
      <span className="people-confirm">
        <Button disabled={save.isPending || levels.isLoading} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save grades"}
        </Button>
      </span>
    </section>
  );
}

function PoliciesSection({ settings }: { settings: SchoolSettings }) {
  const queryClient = useQueryClient();
  const [policies, setPolicies] = useState<Policies>(withPolicyDefaults(settings.policies));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const save = useMutation({
    mutationFn: () => updatePolicies(settings.id, policies),
    onSuccess: () => {
      setFeedback({ ok: true, text: "Policies saved." });
      void queryClient.invalidateQueries({ queryKey: ["school-settings", settings.id] });
    },
    onError: (e) => setFeedback({ ok: false, text: settingsErrorMessage(e) }),
  });

  return (
    <section className="workspace-panel people-panel">
      <SectionHeader eyebrow="POLICIES" title="School policies" />
      <fieldset className="contact-choices">
        <legend className="sr-only">Policies</legend>
        {POLICIES.map((p) => (
          <label key={p.key} className="policy-choice">
            <input
              type="checkbox"
              checked={policies[p.key]}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setPolicies((c) => ({ ...c, [p.key]: on }));
              }}
            />
            <span>
              <strong>{p.label}</strong>
              <span className="people-note"> {p.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FeedbackLine feedback={feedback} />
      <span className="people-confirm">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save policies"}
        </Button>
      </span>
    </section>
  );
}
