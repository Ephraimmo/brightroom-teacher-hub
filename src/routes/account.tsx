import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";

import { useAuth } from "@/components/auth/auth-provider";
import { TeacherWorkspace } from "@/components/teacher/teacher-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Profile | LearnBridge" },
      { name: "description", content: "Review and update your LearnBridge profile details." },
      { property: "og:title", content: "My Profile | LearnBridge" },
      { property: "og:description", content: "Manage your own account profile and see assigned access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

const roleLabels: Record<Enums<"app_role">, string> = {
  platform_admin: "Platform administrator",
  school_admin: "School administrator",
  teacher: "Teacher",
  learner: "Learner",
  parent: "Parent or guardian",
};

function AccountPage() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Sign in to view your profile.");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile is not available yet.");
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["user-roles", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Sign in to view account access.");
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (profile: { full_name: string; display_name: string }) => {
      if (!user) throw new Error("Sign in to update your profile.");
      const { data, error } = await supabase
        .from("profiles")
        .update(profile)
        .eq("id", user.id)
        .select("id, full_name, display_name, preferences")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (!user) return;
      queryClient.setQueryData(["profile", user.id], data);
      setFeedback("Profile saved.");
      setSaveError("");
    },
    onError: () => {
      setSaveError("Your profile could not be saved. Please try again.");
      setFeedback("");
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name);
    setDisplayName(profileQuery.data.display_name ?? "");
  }, [profileQuery.data]);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate({ full_name: fullName.trim(), display_name: displayName.trim() });
  }

  if (isLoading) {
    return <main className="auth-page"><p role="status">Checking your account…</p></main>;
  }

  if (!user) {
    return (
      <main className="auth-page auth-page--compact">
        <section className="reset-panel">
          <p className="page-eyebrow">MY PROFILE</p>
          <h1>Sign in to continue</h1>
          <p className="page-description">Your account details are private and only available after you sign in.</p>
          <Button className="auth-submit" asChild><Link to="/auth">Sign in</Link></Button>
        </section>
      </main>
    );
  }

  const roles = rolesQuery.data ?? [];

  return (
    <TeacherWorkspace active="overview" title="My profile" description="Update your details and review the access assigned to your account.">
      <div className="account-grid">
        <section className="workspace-panel account-panel">
          <div className="section-heading"><div><p className="section-eyebrow">YOUR DETAILS</p><h2>Profile information</h2></div></div>
          {profileQuery.isLoading ? <p role="status">Loading your profile…</p> : null}
          {profileQuery.isError ? <p className="form-message form-message--error" role="alert">Your profile could not be loaded.</p> : null}
          {profileQuery.data ? (
            <form className="auth-form" onSubmit={handleSave}>
              <div className="form-field"><Label htmlFor="profile-full-name">Full name</Label><Input id="profile-full-name" value={fullName} onChange={(event) => setFullName(event.currentTarget.value)} maxLength={100} required /></div>
              <div className="form-field"><Label htmlFor="profile-display-name">Display name</Label><Input id="profile-display-name" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} maxLength={60} /></div>
              {feedback ? <p className="form-message form-message--success" role="status">{feedback}</p> : null}
              {saveError ? <p className="form-message form-message--error" role="alert">{saveError}</p> : null}
              <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Saving…" : "Save changes"}</Button>
            </form>
          ) : null}
        </section>

        <section className="workspace-panel account-panel">
          <div className="section-heading"><div><p className="section-eyebrow">ACCOUNT ACCESS</p><h2>Your role</h2></div></div>
          {rolesQuery.isLoading ? <p role="status">Checking assigned access…</p> : null}
          {rolesQuery.isError ? <p className="form-message form-message--error" role="alert">Assigned access could not be loaded.</p> : null}
          {roles.length > 0 ? (
            <ul className="role-list">{roles.map(({ role }) => <li key={role}>{roleLabels[role]}</li>)}</ul>
          ) : null}
          {!rolesQuery.isLoading && !rolesQuery.isError && roles.length === 0 ? (
            <div className="role-pending"><span className="role-pending-mark" /><strong>Access is not assigned yet</strong><p>A school or platform administrator must assign your role. New users cannot grant themselves school access.</p></div>
          ) : null}
          <p className="account-email-note">Signed in as <strong>{user.email ?? "your account"}</strong></p>
        </section>
      </div>
    </TeacherWorkspace>
  );
}