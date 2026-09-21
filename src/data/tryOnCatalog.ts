/**
 * Static Virtual Try-On catalog.
 *
 * Maps product IDs to their Snap AR lens configuration. This is the source of
 * truth until/unless the Supabase `products.virtual_try_on` column is populated
 * (the DB column always wins when present — see src/lib/tryOnConfig.ts).
 *
 * ⚠️ REAL LENS IDS REQUIRED — placeholders are filtered out by
 * normalizeTryOnConfig(), so a fake value here disables AR for the product
 * rather than shipping a broken experience.
 *
 * How to fill this in:
 *   1. Build a clothing try-on lens per product in Lens Studio
 *      (https://ar.snap.com) — e.g. a garment overlay driven by body tracking.
 *   2. Publish it to your app's lens group in the Lens Scheduler
 *      (https://kit.snapchat.com/lens-scheduler).
 *   3. Copy the 32-hex Lens ID + Lens Group ID here (or into the DB column).
 *
 * Example:
 *   'p-002': {
 *     enabled: true,
 *     lensId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
 *     lensGroupId: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6',
 *     label: 'Powered by Snap AR',
 *   },
 */
import type { VirtualTryOnConfig } from '../types/virtualTryOn';

/** Empty until real lens IDs exist — see comment above. */
export const staticTryOnOverrides: Record<string, VirtualTryOnConfig> = {};
