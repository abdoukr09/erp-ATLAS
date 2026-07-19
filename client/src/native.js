import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// ─── Native session storage ──────────────────────────────────────────────────
// In the browser the refresh token lives in an HTTP-only cookie the server sets.
// Inside the Android app the page origin is https://localhost while the API is
// on erp-canape-client.vercel.app, so that cookie is a third-party cookie and
// Android drops it — the session would die on every token refresh.
//
// On native we therefore keep the refresh token ourselves, in Preferences
// (Android SharedPreferences: survives app restarts, private to the app), and
// send it back in the X-Refresh-Token header.
//
// Every function below is a no-op on the web, so the browser flow is untouched.

const REFRESH_TOKEN_KEY = 'atlas_refresh_token';

/** True only inside the Capacitor app (false in any browser) */
export const isNative = () => Capacitor.isNativePlatform();

/** Read the stored refresh token, or null on web / when logged out */
export async function getRefreshToken() {
  if (!isNative()) return null;
  try {
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return value || null;
  } catch {
    return null;
  }
}

/** Persist the refresh token issued (or rotated) by the server */
export async function saveRefreshToken(token) {
  if (!isNative()) return;
  try {
    if (token) {
      await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
    } else {
      await Preferences.remove({ key: REFRESH_TOKEN_KEY });
    }
  } catch { /* storage unavailable — user simply has to log in again */ }
}

/** Wipe the stored token (logout, or session definitively rejected) */
export async function clearRefreshToken() {
  if (!isNative()) return;
  try {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  } catch { /* ignore */ }
}
