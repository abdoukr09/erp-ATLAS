import { Preferences } from '@capacitor/preferences';

// ─── Device identity ────────────────────────────────────────────────────────
// Every movement carries the id of the tablet that produced it, so a wrong
// count can be traced back to one device instead of the whole warehouse.
// Generated once on first launch and kept in Preferences (survives app
// restarts; only wiped if the app data is cleared).

const DEVICE_ID_KEY = 'atlas_device_id';
let cached = null;

/** Stable id for this tablet, created on first call */
export async function getDeviceId() {
  if (cached) return cached;

  const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
  if (value) {
    cached = value;
    return cached;
  }

  // Short and human-readable: it shows up in the movements table
  const fresh = `TAB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await Preferences.set({ key: DEVICE_ID_KEY, value: fresh });
  cached = fresh;
  return cached;
}
