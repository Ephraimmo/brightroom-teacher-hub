import "@testing-library/jest-dom/vitest";

import { configure } from "@testing-library/react";

// Screens can take a moment to settle when the whole suite runs at once.
configure({ asyncUtilTimeout: 5000 });

// Browser stubs. Skipped for tests that run in plain Node (database tests).
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
