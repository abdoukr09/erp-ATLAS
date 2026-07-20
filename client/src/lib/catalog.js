import localforage from 'localforage';
import api from '../api';

// ─── Local catalogue cache ──────────────────────────────────────────────────
// A copy of every article (barcode → name + stock) kept in IndexedDB, so the
// scanner can name what it reads and the stock pages can open with no network.
// Refreshed on every successful connection and after each sync.

const store = localforage.createInstance({
  name: 'atlas-erp',
  storeName: 'catalog',
});

const SNAPSHOT_KEY = 'snapshot';

/** ATL-M-xxxxxx → product model, ATL-P-xxxxxx → material.
 *  M is "Modèle", P is the packaged part stored in materials — NOT "matière".
 *  Confirmed against production data; swapping them corrupts stock silently. */
export function targetTypeFromBarcode(barcode = '') {
  const code = String(barcode).trim().toUpperCase();
  if (code.startsWith('ATL-M-')) return 'model';
  if (code.startsWith('ATL-P-')) return 'material';
  return null;
}

/** Flatten both lists into one barcode-keyed index for O(1) scan lookups */
function buildIndex(snapshot) {
  const index = {};
  for (const m of snapshot.models || []) {
    if (m.barcode) index[m.barcode.toUpperCase()] = { ...m, targetType: 'model' };
  }
  for (const m of snapshot.materials || []) {
    if (m.barcode) index[m.barcode.toUpperCase()] = { ...m, targetType: 'material' };
  }
  return index;
}

/** Read the cached snapshot, or null if this tablet never synced */
export async function getCachedSnapshot() {
  return (await store.getItem(SNAPSHOT_KEY)) || null;
}

/** Download a fresh snapshot and cache it. Throws when offline. */
export async function refreshSnapshot() {
  const { data } = await api.get('/sync/snapshot');
  const snapshot = {
    syncedAt: data.syncedAt,
    models: data.models || [],
    materials: data.materials || [],
    index: buildIndex(data),
  };
  await store.setItem(SNAPSHOT_KEY, snapshot);
  return snapshot;
}

/** Cached snapshot if present, otherwise fetch one */
export async function loadSnapshot() {
  return (await getCachedSnapshot()) || refreshSnapshot();
}

/** Resolve a scanned string against the cache. null when unknown. */
export async function findByBarcode(barcode) {
  const snapshot = await getCachedSnapshot();
  if (!snapshot) return null;
  return snapshot.index?.[String(barcode).trim().toUpperCase()] || null;
}

/**
 * Apply deltas to the cached stock so the tablet shows the new numbers straight
 * away, without waiting for a round trip. The server stays the source of truth:
 * the next refreshSnapshot() overwrites whatever we guessed here.
 */
export async function applyLocalDeltas(movements = []) {
  const snapshot = await getCachedSnapshot();
  if (!snapshot) return null;

  for (const mv of movements) {
    const key = String(mv.barcode).trim().toUpperCase();
    const entry = snapshot.index?.[key];
    if (!entry) continue;

    entry.stock = (Number(entry.stock) || 0) + Number(mv.delta);

    const list = entry.targetType === 'model' ? snapshot.models : snapshot.materials;
    const row = list.find((r) => r.id === entry.id);
    if (row) row.stock = entry.stock;
  }

  await store.setItem(SNAPSHOT_KEY, snapshot);
  return snapshot;
}
