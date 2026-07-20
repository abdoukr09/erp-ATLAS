import { enqueue, syncOutbox } from './outbox';
import { getDeviceId } from './device';

/**
 * Route a manual ± button from the tablet through the movement queue — the same
 * path a scan takes.
 *
 * Two reasons this must not call the REST endpoints directly:
 *  - offline, a PUT simply fails and the tap is lost;
 *  - the materials endpoint takes an ABSOLUTE stock value, so a tablet showing
 *    a stale number would wipe out whatever the office set in the meantime.
 *
 * Returns false when the article has no barcode (nothing to attach a movement
 * to); the caller should tell the user rather than pretend it worked.
 */
export async function queueStockAdjustment({ barcode, delta, targetType, userId, note }) {
  if (!barcode || !delta) return false;

  const deviceId = await getDeviceId();
  await enqueue([{
    deviceId,
    userId,
    targetType,
    barcode,
    delta,
    source: 'manuel',
    note: note || null,
  }]);

  // Best effort: offline it stays queued and leaves with the next sync
  try { await syncOutbox(); } catch { /* queued */ }
  return true;
}
