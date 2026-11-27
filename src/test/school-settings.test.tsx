import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchoolSettingsPage } from "@/components/school/settings-page";
import {
  defaultPeriod,
  groupPeriods,
  periodRange,
  validateTerm,
  validateYear,
  withPolicyDefaults,
  type AcademicYear,
  type PeriodRow,
} from "@/domain/school-settings";

const settingsApi = vi.hoisted(() => ({
  getSchoolSettings: vi.fn(),
  updateSchoolDetails: vi.fn(),
  updatePolicies: vi.fn(),
  listGradeLevels: vi.fn(),
  setGrades: vi.fn(),
  getAcademicPeriods: vi.fn(),
  saveAcademicYear: vi.fn(),
  saveTerm: vi.fn(),
}));
vi.mock("@/lib/school-settings", () => settingsApi);
vi.mock("@/lib/schools", () => ({
  myInstitutions: () =>
    Promise.resolve([
      { institutionId: "s1", name: "Sunrise Primary", role: "school_admin", title: null },
    ]),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "a1", email: "head@sunrise.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "school_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const year2027: AcademicYear = {
  id: "y27",
  label: "2027",
  startsOn: "2027-01-13",
  endsOn: "2027-12-08",
  isCurrent: true,
  terms: [
    { id: "t1", number: 1, startsOn: "2027-01-13", endsOn: "2027-03-27", isCurrent: false },
    { id: "t2", number: 2, startsOn: "2027-04-07", endsOn: "2027-06-26", isCurrent: true },
  ],
};

describe("calendar rules", () => {
  it("groups period rows into years with terms", () => {
    const rows: PeriodRow[] = [
      {
        year_id: "y27",
        year_label: "2027",
        year_starts_on: "2027-01-13",
        year_ends_on: "2027-12-08",
        year_is_current: true,
        term_id: "t1",
        term_number: 1,
        term_starts_on: "2027-01-13",
        term_ends_on: "2027-03-27",
        term_is_current: true,
      },
      {
        year_id: "y28",
        year_label: "2028",
        year_starts_on: "2028-01-12",
        year_ends_on: "2028-12-06",
        year_is_current: false,
        term_id: null,
        term_number: null,
        term_starts_on: null,
        term_ends_on: null,
        term_is_current: false,
      },
    ];
    const years = groupPeriods(rows);
    expect(years.map((y) => [y.label, y.terms.length])).toEqual([
      ["2027", 1],
      ["2028", 0],
    ]);
  });

  it("filters default to the current term and cover its dates", () => {
    const selection = defaultPeriod([year2027]);
    expect(selection).toEqual({ yearId: "y27", termId: "t2" });
    expect(periodRange([year2027], selection)).toEqual({ from: "2027-04-07", to: "2027-06-26" });
    expect(periodRange([year2027], { yearId: "y27", termId: null })).toEqual({
      from: "2027-01-13",
      to: "2027-12-08",
    });
    expect(defaultPeriod([])).toEqual({ yearId: null, termId: null });
  });

  it("checks years", () => {
    const ok = { label: "2028", startsOn: "2028-01-12", endsOn: "2028-12-06", makeCurrent: false };
    expect(validateYear(ok, [year2027])).toEqual({});
    expect(validateYear({ ...ok, startsOn: "2027-11-01" }, [year2027]).startsOn).toMatch(/overlap/);
    expect(validateYear({ ...ok, endsOn: "2027-12-01" }, []).endsOn).toMatch(/after/);
    expect(validateYear({ ...ok, endsOn: "2030-01-01" }, []).endsOn).toMatch(/18 months/);
  });

  it("checks terms", () => {
    expect(
      validateTerm({ number: 3, startsOn: "2027-07-14", endsOn: "2027-09-23" }, year2027),
    ).toEqual({});
    expect(
      validateTerm({ number: 3, startsOn: "2027-06-20", endsOn: "2027-09-23" }, year2027).startsOn,
    ).toMatch(/overlap/);
    expect(
      validateTerm({ number: 4, startsOn: "2027-10-01", endsOn: "2028-01-10" }, year2027).startsOn,
    ).toMatch(/inside 2027/);
  });

  it("fills in policy defaults", () => {
    expect(withPolicyDefaults({ ai_assistance: true, junk: 1 })).toEqual({
      lesson_recording: false,
      ai_assistance: true,
      parent_messaging: true,
      learner_messaging: false,
    });
  });
});

function renderPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/school/settings",
    component: SchoolSettingsPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/school/settings"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  settingsApi.getSchoolSettings.mockResolvedValue({
    id: "s1",
    name: "Sunrise Primary",
    type: "school",
    emisNumber: "",
    province: "GP",
    district: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    policies: {},
    grades: ["G01"],
  });
  settingsApi.getAcademicPeriods.mockResolvedValue([year2027]);
  settingsApi.listGradeLevels.mockResolvedValue([
    { code: "G00", label: "Grade R", phase: "foundation" },
    { code: "G01", label: "Grade 1", phase: "foundation" },
  ]);
});

describe("School settings page", () => {
  it("shows the school's details, calendar, grades and policies", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("Sunrise Primary")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "2027" })).toBeInTheDocument();
    expect(screen.getByText("Current year")).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: "Grade 1" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /AI study help/ })).not.toBeChecked();
  });

  it("saves the school's details", async () => {
    settingsApi.updateSchoolDetails.mockResolvedValue(true);
    renderPage();
    const name = await screen.findByDisplayValue("Sunrise Primary");
    fireEvent.change(name, { target: { value: "Sunrise Primary School" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("School details saved.")).toBeInTheDocument();
    expect(settingsApi.updateSchoolDetails).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ name: "Sunrise Primary School" }),
    );
  });

  it("adds a term, checking it fits the year first", async () => {
    settingsApi.saveTerm.mockResolvedValue("t3");
    renderPage();
    const term3 = await screen.findByRole("group", { name: "2027 term 3" });
    fireEvent.change(within(term3).getByLabelText("Starts"), { target: { value: "2027-07-14" } });
    fireEvent.change(within(term3).getByLabelText("Ends"), { target: { value: "2028-01-20" } });
    fireEvent.click(within(term3).getByRole("button", { name: "Save" }));
    expect(await within(term3).findByText(/inside 2027/)).toBeInTheDocument();
    expect(settingsApi.saveTerm).not.toHaveBeenCalled();

    fireEvent.change(within(term3).getByLabelText("Ends"), { target: { value: "2027-09-23" } });
    fireEvent.click(within(term3).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(settingsApi.saveTerm).toHaveBeenCalledWith("y27", {
        number: 3,
        startsOn: "2027-07-14",
        endsOn: "2027-09-23",
      }),
    );
  });

  it("saves grades and policies", async () => {
    settingsApi.setGrades.mockResolvedValue(undefined);
    settingsApi.updatePolicies.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grade R" }));
    fireEvent.click(screen.getByRole("button", { name: "Save grades" }));
    await waitFor(() => expect(settingsApi.setGrades).toHaveBeenCalledWith("s1", ["G01", "G00"]));
    fireEvent.click(screen.getByRole("checkbox", { name: /AI study help/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save policies" }));
    await waitFor(() =>
      expect(settingsApi.updatePolicies).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ ai_assistance: true }),
      ),
    );
  });
});
