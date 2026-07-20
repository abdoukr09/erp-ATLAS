import localforage from 'localforage';
import api from '../api';
import { applyLocalDeltas, refreshSnapshot } from './catalog';

// ─── Outbox ─────────────────────────────────────────────────────────────────
// Movements created on the tablet wait here until the server confirms them.
// Nothing is ever removed on a guess: a movement leaves the queue only when the
// server answers "applied" or "duplicate" for its opUuid. A batch cut off
// mid-flight is simply re-sent later — the opUuid makes that harmless.

const store = localforage.createInstance({
  name: 'atlas-erp',
  storeName: 'outbox',
});

const QUEUE_KEY = 'movements';
const BATCH_SIZE = 100;

const listeners = new Set();

/** Subscribe to queue-size changes (banner, badges) */
export function onOutboxChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function notify() {
  const queue = await getQueue();
  listeners.forEach((fn) => {
    try { fn(queue.length); } catch { /* a bad listener must not break sync */ }
  });
}

export async function getQueue() {
  return (await store.getItem(QUEUE_KEY)) || [];
}

export async function getPendingCount() {
  return (await getQueue()).length;
}

/**
 * Queue movements and update the displayed stock immediately.
 * Returns the queued rows; call syncOutbox() to try sending them.
 */
export async function enqueue(movements = []) {
  if (!movements.length) return [];

  const queue = await getQueue();
  const stamped = movements.map((mv) => ({
    ...mv,
    // Generated here, on the device: it is what makes a re-send idempotent.
    opUuid: mv.opUuid || crypto.randomUUID(),
    createdAt: mv.createdAt || new Date().toISOString(),
  }));

  await store.setItem(QUEUE_KEY, [...queue, ...stamped]);
  await applyLocalDeltas(stamped);
  await notify();
  return stamped;
}

let syncing = false;

/**
 * Push the queue to the server, oldest first, in batches.
 * Safe to call at any time: concurrent calls collapse into one.
 */
export async function syncOutbox({ refresh = true } = {}) {
  if (syncing) return { skipped: true };
  const queue = await getQueue();
  if (!queue.length) return { applied: 0, duplicates: 0, errors: 0, remaining: 0 };

  syncing = true;
  const totals = { applied: 0, duplicates: 0, errors: 0, failed: [] };

  try {
    let remaining = [...queue];

    while (remaining.length) {
      const batch = remaining.slice(0, BATCH_SIZE);
      const { data } = await api.post('/sync/movements', { movements: batch });

      // Only opUuids the server actually accounted for leave the queue.
      // Anything else stays and is retried on the next attempt.
      const settled = new Set(
        (data.results || [])
          .filter((r) => r.status === 'applied' || r.status === 'duplicate')
          .map((r) => r.opUuid)
      );

      totals.applied += data.applied || 0;
      totals.duplicates += data.duplicates || 0;
      totals.errors += data.errors || 0;
      totals.failed.push(...(data.results || []).filter((r) => r.status === 'error'));

      // A movement the server rejects (unknown barcode) would block the queue
      // forever, so it is dropped here and reported to the user instead.
      const rejected = new Set(
        (data.results || []).filter((r) => r.status === 'error').map((r) => r.opUuid)
      );

      remaining = remaining.slice(batch.length);
      const stillQueued = (await getQueue()).filter(
        (mv) => !settled.has(mv.opUuid) && !rejected.has(mv.opUuid)
      );
      await store.setItem(QUEUE_KEY, stillQueued);
    }

    if (refresh) {
      // Server is authoritative — replace our optimistic numbers with real ones
      try { await refreshSnapshot(); } catch { /* stay on cached data */ }
    }

    await notify();
    return { ...totals, remaining: (await getQueue()).length };
  } finally {
    syncing = false;
  }
}

/** Wipe the queue. Only for an explicit user action — data is lost. */
export async function clearQueue() {
  await store.setItem(QUEUE_KEY, []);
  await notify();
}
