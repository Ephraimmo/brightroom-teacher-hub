import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { ErrorState, LoadingState } from "@/components/design/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  avatarFileProblem,
  AVATAR_TYPES,
  formatSaMobile,
  LANGUAGES,
  profileErrorFor,
  validateProfile,
  type LanguageCode,
  type ProfileErrors,
  type ProfileForm,
} from "@/domain/profile";
import {
  avatarLink,
  loadMyProfile,
  removeMyAvatar,
  replaceMyAvatar,
  saveMyProfile,
  type MyProfile,
} from "@/lib/profile-service";

const profileKey = (userId: string) => ["my-profile", userId] as const;

/** The "Your details" panel on My profile. */
export function ProfileEditor({ userId }: { userId: string }) {
  const profile = useQuery({
    queryKey: profileKey(userId),
    queryFn: () => loadMyProfile(userId),
  });

  if (profile.isLoading) return <LoadingState label="Loading your profile…" rows={4} />;
  if (profile.isError || !profile.data) {
    return (
      <ErrorState title="Your profile could not be loaded" onRetry={() => void profile.refetch()} />
    );
  }
  return (
    <>
      {profile.data.extended ? <PhotoSection userId={userId} profile={profile.data} /> : null}
      <DetailsForm userId={userId} profile={profile.data} />
    </>
  );
}

function DetailsForm({ userId, profile }: { userId: string; profile: MyProfile }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(() => ({
    ...profile,
    phone: formatSaMobile(profile.phone || null),
  }));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: (values: ProfileForm) => saveMyProfile(userId, values, profile.extended),
    onSuccess: (changed) => {
      setResult({ ok: true, text: changed ? "Profile saved." : "Nothing to save: no changes." });
      void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
    },
    onError: (error) => {
      const known = profileErrorFor(error);
      if (known && known.field !== "photo") {
        setErrors({ [known.field]: known.message });
        setResult(null);
      } else {
        setResult({ ok: false, text: "Your profile could not be saved. Please try again." });
      }
    },
  });

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const problems = profile.extended
      ? validateProfile(form)
      : validateProfile({ ...form, phone: "", contactSms: false, contactWhatsapp: false });
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    save.mutate(form);
  }

  return (
    <form className="auth-form profile-form" onSubmit={handleSubmit} noValidate>
      <FormField id="profile-full-name" label="Full name" error={errors.fullName} required>
        <Input
          value={form.fullName}
          maxLength={100}
          autoComplete="name"
          onChange={(e) => set("fullName", e.currentTarget.value)}
        />
      </FormField>
      <FormField
        id="profile-display-name"
        label="Display name"
        hint="What others see in classes and messages. Leave empty to use your full name."
        error={errors.displayName}
      >
        <Input
          value={form.displayName}
          maxLength={60}
          onChange={(e) => set("displayName", e.currentTarget.value)}
        />
      </FormField>

      {profile.extended ? (
        <>
          <FormField
            id="profile-phone"
            label="Mobile number"
            hint="South African mobile, for example 082 123 4567. Kept private and used only for the contact choices below."
            error={errors.phone}
          >
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.currentTarget.value)}
            />
          </FormField>

          <FormField
            id="profile-language"
            label="Preferred language"
            hint="LearnBridge is in English for now. We'll use this when other languages are added."
            error={errors.language}
          >
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
            aria-describedby={errors.contact ? "profile-contact-error" : undefined}
          >
            <legend>How we can contact you</legend>
            <p className="form-hint">
              Messages always appear in LearnBridge. Choose where else you'd like them.
            </p>
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
              <p id="profile-contact-error" className="form-error">
                {errors.contact}
              </p>
            ) : null}
          </fieldset>
        </>
      ) : (
        <p className="form-hint">
          More options (mobile number, language, contact choices and photo) will appear here once
          the latest database update is applied.
        </p>
      )}

      {result ? (
        <p
          className={`form-message ${result.ok ? "form-message--success" : "form-message--error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.text}
        </p>
      ) : null}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function PhotoSection({ userId, profile }: { userId: string; profile: MyProfile }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const path = profile.avatarPath;

  useEffect(() => {
    let cancelled = false;
    setLink(null);
    if (path) {
      avatarLink(path)
        .then((url) => !cancelled && setLink(url))
        .catch(() => !cancelled && setLink(null));
    }
    return () => {
      cancelled = true;
    };
  }, [path]);

  const done = () => {
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
    void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
  };
  const upload = useMutation({
    mutationFn: (file: File) => replaceMyAvatar(userId, file, path),
    onSuccess: done,
    onError: () => setError("Your photo could not be uploaded. Please try again."),
  });
  const remove = useMutation({
    mutationFn: () => removeMyAvatar(path ?? ""),
    onSuccess: done,
    onError: () => setError("Your photo could not be removed. Please try again."),
  });
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="profile-photo">
      <div className="profile-photo-frame">
        {link ? <img src={link} alt="Your profile photo" /> : <UserRound aria-hidden="true" />}
      </div>
      <div className="profile-photo-actions">
        <SectionHeader title="Profile photo" />
        <p className="form-hint">
          JPG, PNG or WebP, up to 2 MB. Kept private: it's never shown publicly.
        </p>
        <div className="profile-photo-buttons">
          <Button size="sm" variant="outline" disabled={busy} asChild>
            <label htmlFor="profile-photo-input">
              {upload.isPending ? "Uploading…" : path ? "Change photo" : "Upload photo"}
            </label>
          </Button>
          <input
            ref={fileInput}
            id="profile-photo-input"
            className="sr-only"
            type="file"
            accept={AVATAR_TYPES.join(",")}
            disabled={busy}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const problem = avatarFileProblem(file);
              if (problem) {
                setError(problem);
                e.currentTarget.value = "";
                return;
              }
              upload.mutate(file);
            }}
          />
          {path ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove.mutate()}>
              {remove.isPending ? "Removing…" : "Remove photo"}
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
