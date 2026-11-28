import { useSyncExternalStore } from "react";

import type { DemoRole } from "./demo-data";
import { demoRole, subscribeDemo } from "./demo-session";

/** The active demo role, kept in step with sessionStorage. Null on the server. */
export function useDemoRole(): DemoRole | null {
  return useSyncExternalStore(subscribeDemo, demoRole, () => null);
}
