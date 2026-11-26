import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormField } from "@/components/design/form-field";
import { PageHeader, SectionHeader } from "@/components/design/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import { Input } from "@/components/ui/input";
import { routeTree } from "@/routeTree.gen";

describe("FormField", () => {
  it("labels the control and links hint and error for screen readers", () => {
    render(
      <FormField id="name" label="Full name" hint="As on the birth certificate" error="Required">
        <Input />
      </FormField>,
    );

    const input = screen.getByLabelText("Full name");
    expect(input).toHaveAttribute("id", "name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "name-hint name-error");
    expect(screen.getByText("Required")).toHaveAttribute("id", "name-error");
  });

  it("leaves a valid optional field unmarked", () => {
    render(
      <FormField id="nick" label="Nickname">
        <Input />
      </FormField>,
    );

    const input = screen.getByLabelText("Nickname");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toBeRequired();
  });

  it("marks required fields on the control itself", () => {
    render(
      <FormField id="email" label="Email" required>
        <Input />
      </FormField>,
    );

    expect(screen.getByRole("textbox")).toBeRequired();
  });

  it("passes the wiring to a nested control through a function child", () => {
    render(
      <FormField id="grade" label="Grade" error="Choose a grade">
        {(p) => (
          <div>
            <button type="button" {...p}>
              Pick
            </button>
          </div>
        )}
      </FormField>,
    );

    const trigger = screen.getByRole("button", { name: "Grade" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "grade-error");
  });
});

describe("StatusPill", () => {
  it("applies the tone class and keeps the text", () => {
    render(<StatusPill tone="danger">Overdue</StatusPill>);
    const pill = screen.getByText("Overdue");
    expect(pill).toHaveClass("status-pill", "status-pill--danger");
  });

  it("uses no modifier for neutral", () => {
    render(<StatusPill>Draft</StatusPill>);
    expect(screen.getByText("Draft").className).toBe("status-pill");
  });
});

describe("data states", () => {
  it("announces loading to screen readers", () => {
    render(<LoadingState label="Loading learners…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading learners…");
  });

  it("shows an empty state with its next step", () => {
    render(
      <EmptyState title="No learners yet" action={<button type="button">Add learner</button>} />,
    );
    expect(screen.getByRole("heading", { name: "No learners yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add learner" })).toBeInTheDocument();
  });

  it("shows an error as an alert with a working retry", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("This didn't load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers no retry button when retrying can't help", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("headings", () => {
  it("renders page and section headings at the right levels", () => {
    render(
      <>
        <PageHeader eyebrow="SCHOOL" title="Learners" description="Everyone enrolled" />
        <SectionHeader title="Grade 8" />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Learners" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Grade 8" })).toBeInTheDocument();
  });
});

describe("design system page", () => {
  it("has a route at /design-system", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const match = router.matchRoutes("/design-system").at(-1);
    expect(match?.routeId).not.toBe(rootRouteId);
    expect(match?.routeId).toBe("/design-system");
  });
});
