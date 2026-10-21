// File limits in one place. Celek G moves plan-dependent ones (sponsor logos,
// documents) into its versioned price list; the logo limit is the same for
// every plan.

/** An uploaded or imported logo, before conversion. */
export const LOGO_MAX_BYTES = 1024 * 1024;
/** Longest side of a stored logo. Crests render at 160 px at most. */
export const LOGO_MAX_DIMENSION = 512;
export const LOGO_WEBP_QUALITY = 85;
/** Refuses decompression bombs: a small PNG can claim a gigantic canvas. */
export const MAX_INPUT_PIXELS = 40_000_000;

/** An upload nothing saved within this long is swept. */
export const UNATTACHED_GRACE_MS = 24 * 60 * 60 * 1000;

export const EXTERNAL_FETCH_TIMEOUT_MS = 5000;
export const EXTERNAL_FETCH_MAX_REDIRECTS = 3;
