import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/landing/landing-page";
import type { SiteContact } from "@/config/site";
import { routeTree } from "@/routeTree.gen";

/** Render the landing page inside a router so its links resolve. */
async function renderLanding(contact: SiteContact | null) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const home = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <LandingPage contact={contact} />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([home]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return view;
}

/** Every link on the page must go somewhere real: a section on the page, an app route, or a contact link. */
function expectNoDeadLinks(container: HTMLElement) {
  const appRouter = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  const links = Array.from(container.querySelectorAll("a"));
  expect(links.length).toBeGreaterThan(5);

  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    expect(href, `link "${link.textContent}" has no href`).not.toBe("");
    if (href.startsWith("#")) {
      expect(container.querySelector(href), `${href} has no matching section`).not.toBeNull();
    } else if (href.startsWith("/")) {
      const path = href.split("?")[0] ?? href;
      const leaf = appRouter.matchRoutes(path).at(-1);
      expect(leaf?.routeId, `${href} is not an app page`).not.toBe("__root__");
    } else {
      expect(href).toMatch(/^(mailto:|tel:|https:\/\/wa\.me\/)/);
    }
  }
}

describe("LandingPage without contact details", () => {
  it("covers overview, features, how it works and plans", async () => {
    await renderLanding(null);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/classroom and online/i);
    for (const name of [/built to do/i, /how it works/i, /^plans$/i]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("shows plans without inventing prices", async () => {
    await renderLanding(null);
    const plans = screen.getByRole("heading", { level: 2, name: /^plans$/i }).closest("section")!;
    expect(within(plans).getAllByText("Pricing coming soon")).toHaveLength(4);
    expect(plans.textContent).not.toMatch(/R\s?\d/);
  });

  it("hides the contact section and sends schools to create-account", async () => {
    const { container } = await renderLanding(null);
    expect(container.querySelector("#contact")).toBeNull();
    expect(screen.queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register your school" })).toHaveAttribute(
      "href",
      "/auth?mode=sign-up",
    );
  });

  it("offers sign-in and create-account", async () => {
    await renderLanding(null);
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/auth");
    expect(screen.getAllByRole("link", { name: "Create account" })[0]).toHaveAttribute(
      "href",
      "/auth?mode=sign-up",
    );
  });

  it("has no dead links", async () => {
    const { container } = await renderLanding(null);
    expectNoDeadLinks(container);
  });
});

describe("LandingPage with contact details", () => {
  const contact: SiteContact = {
    email: "hello@example.co.za",
    phone: "082 123 4567",
    whatsapp: "+27 82 123 4567",
    location: "Durban",
  };

  it("shows working contact links and points schools to them", async () => {
    const { container } = await renderLanding(contact);
    const section = container.querySelector("#contact") as HTMLElement;
    expect(section).not.toBeNull();
    expect(within(section).getByRole("link", { name: "hello@example.co.za" })).toHaveAttribute(
      "href",
      "mailto:hello@example.co.za",
    );
    expect(within(section).getByRole("link", { name: "082 123 4567" })).toHaveAttribute(
      "href",
      "tel:0821234567",
    );
    expect(within(section).getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href",
      "https://wa.me/27821234567",
    );
    expect(screen.getByRole("link", { name: "Register your school" })).toHaveAttribute(
      "href",
      "#contact",
    );
    expectNoDeadLinks(container);
  });
});
