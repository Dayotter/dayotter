/**
 * DayOtter ships in two editions:
 *
 * - **Self-hosted** (the open-source default): every feature is unlocked, no
 *   billing. Cloud-only (`ee/`) features simply don't exist in this build.
 * - **Cloud** (dayotter.com): a free tier + a $9/seat/mo Pro plan gate the
 *   differentiator features, and the `ee/` cloud-only features are available.
 *
 * The edition is chosen at deploy time via `DAYOTTER_CLOUD=1`. It is NOT a
 * runtime user setting - a self-hoster can never accidentally paywall themselves.
 */
export const isCloud = process.env.DAYOTTER_CLOUD === "1";

/** Monthly per-seat price shown in the UI (USD). Keep in sync with the Stripe price. */
export const PRO_PRICE_USD = 9;
