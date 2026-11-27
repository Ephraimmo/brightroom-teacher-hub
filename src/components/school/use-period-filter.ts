import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { defaultPeriod, type AcademicYear, type PeriodSelection } from "@/domain/school-settings";
import { getAcademicPeriods } from "@/lib/school-settings";

export const periodsKey = (institutionId: string) => ["academic-periods", institutionId] as const;

/**
 * A school's academic years and terms, and the year/term the person is
 * looking at (defaults to the current term). Class and report pages pass the
 * selection to their queries.
 */
export function usePeriodFilter(institutionId: string) {
  const periods = useQuery({
    queryKey: periodsKey(institutionId),
    retry: false,
    queryFn: () => getAcademicPeriods(institutionId),
  });
  const years: AcademicYear[] = periods.data ?? [];
  const [selection, setSelection] = useState<PeriodSelection>({ yearId: null, termId: null });

  useEffect(() => {
    if (periods.data && selection.yearId === null) setSelection(defaultPeriod(periods.data));
  }, [periods.data, selection.yearId]);

  return { years, selection, setSelection, isLoading: periods.isLoading, error: periods.error };
}
