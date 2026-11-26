/**
 * Request IDs tie a user's "Reference" on an error page to the matching log
 * lines. The server sets one per request (src/server.ts) and returns it in
 * the `x-request-id` response header.
 */
export const REQUEST_ID_HEADER = "x-request-id";

/** Only accept IDs that are short and harmless to log. */
const VALID_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** A new 16-character ID, short enough to read out over the phone. */
export function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Reuse an ID set by the hosting edge (x-request-id, or Cloudflare's cf-ray) so
 * our logs line up with theirs; otherwise make a new one.
 */
export function requestIdFrom(headers: Headers): string {
  for (const name of [REQUEST_ID_HEADER, "cf-ray"]) {
    const value = headers.get(name);
    if (value && VALID_ID.test(value)) return value;
  }
  return newRequestId();
}

/** IDs for requests whose headers are read-only (as in the Cloudflare Worker). */
const taggedRequests = new WeakMap<Request, string>();

/** Attach the ID to the request: in its headers where allowed, otherwise on the side. */
export function tagRequest(request: Request, requestId: string): void {
  taggedRequests.set(request, requestId);
  try {
    request.headers.set(REQUEST_ID_HEADER, requestId);
  } catch {
    // Read-only headers: the WeakMap above still has it.
  }
}

/** The ID that src/server.ts gave this request, or a fresh one if it wasn't tagged. */
export function requestIdOf(request: Request): string {
  return taggedRequests.get(request) ?? requestIdFrom(request.headers);
}
