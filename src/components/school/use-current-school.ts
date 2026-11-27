import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import type { MembershipRole } from "@/domain/schools";
import { myInstitutions, type MySchool } from "@/lib/schools";

const STORAGE_KEY = "learnbridge.currentSchool";

export const mySchoolsKey = (userId: string | undefined) =>
  ["my-schools", userId ?? "signed-out"] as const;

/**
 * The school the person is working in right now, among the schools where they
 * hold `role`. Remembered on this device; the database still checks every
 * request against the person's real memberships.
 */
export function useCurrentSchool(role: MembershipRole = "school_admin") {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: mySchoolsKey(user?.id),
    enabled: Boolean(user),
    queryFn: myInstitutions,
  });
  const schools: MySchool[] = (query.data ?? []).filter((s) => s.role === role);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    try {
      setChosen(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setChosen(null);
    }
  }, []);

  const current = schools.find((s) => s.institutionId === chosen) ?? schools[0] ?? null;

  function choose(id: string) {
    setChosen(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private browsing: the choice lasts until the page is reloaded.
    }
  }

  return {
    schools,
    current,
    choose,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
