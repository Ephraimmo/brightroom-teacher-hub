/**
 * Whether this browser tab is in demo mode, and as whom. Stored in
 * sessionStorage, so closing the tab ends the demo. Demo mode never talks to
 * the database: the service modules in src/lib answer from src/demo/demo-store.ts.
 */
import { DEMO_PERSONAS, personaFor, type DemoRole } from "./demo-data";

const ROLE_KEY = "learnbridge.demo.role";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isDemoRole = (value: unknown): value is DemoRole =>
  DEMO_PERSONAS.some((p) => p.role === value);

/** The role being explored, or null outside demo mode. */
export function demoRole(): DemoRole | null {
  const value = storage()?.getItem(ROLE_KEY);
  return isDemoRole(value) ? value : null;
}

export const isDemo = (): boolean => demoRole() !== null;

/** The demo person's account id, or null outside demo mode. */
export function demoUserId(): string | null {
  const role = demoRole();
  return role ? personaFor(role).userId : null;
}

export function startDemo(role: DemoRole): void {
  storage()?.setItem(ROLE_KEY, role);
  notify();
}

export function endDemo(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(ROLE_KEY);
  notify();
}
