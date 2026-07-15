import { initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Verifies Firebase ID tokens sent by the control-room client so the socket
 * server can tell an authenticated operator apart from any other client that
 * happens to connect (mobile cameras, projector/teleprompter displays, or an
 * uninvited third party).
 *
 * Configuration is optional and degrades gracefully: if
 * FIREBASE_SERVICE_ACCOUNT_KEY isn't set, `isAuthEnforced()` returns false
 * and every socket is treated as authenticated, preserving the previous
 * (unauthenticated) behavior instead of breaking deployments that haven't
 * set this up yet. A clear warning is logged either way (see server/index.ts
 * startup) so it's obvious which mode the server is running in.
 *
 * Setup: create a Firebase service account key (Project settings > Service
 * accounts > Generate new private key) and set its JSON contents as the
 * FIREBASE_SERVICE_ACCOUNT_KEY env var (as a single-line string). See
 * docs/DEPLOYMENT.md for the full walkthrough.
 */

let app: App | null = null;
let initAttempted = false;
let initError: string | null = null;

function tryInit(): void {
  if (initAttempted) return;
  initAttempted = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return;

  try {
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({ credential: cert(serviceAccount) }, "abcfpt-socket-auth");
  } catch (err: any) {
    initError = err?.message || "Failed to initialize firebase-admin";
  }
}

/** Whether the server is actually verifying tokens (vs. allowing everyone through). */
export function isAuthEnforced(): boolean {
  tryInit();
  return app !== null;
}

export function authInitError(): string | null {
  tryInit();
  return initError;
}

/**
 * Verifies a Firebase ID token. Returns the decoded uid on success, or null
 * if the token is missing/invalid, or if auth isn't configured (in which
 * case callers should treat every connection as implicitly authenticated —
 * see isAuthEnforced()).
 */
export async function verifyIdToken(token: string | undefined): Promise<string | null> {
  tryInit();
  if (!app || !token) return null;

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
