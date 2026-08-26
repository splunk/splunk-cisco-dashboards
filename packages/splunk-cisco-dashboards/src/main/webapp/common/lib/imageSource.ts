/**
 * Normalization for image sources that can come from shared app configuration.
 *
 * Shared content must not cause every viewer's browser to fetch an arbitrary
 * network or local URL. Self-contained image data and this app's static image
 * paths are the two supported source classes.
 */

export const MAX_SHARED_IMAGE_SOURCE_BYTES = 256 * 1024;
export const MAX_DASHBOARD_BACKGROUND_SOURCE_BYTES = 3 * 1024 * 1024;
export const MAX_DASHBOARD_BACKGROUND_UPLOAD_BYTES = 2 * 1024 * 1024;

const IMAGE_DATA_URI_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;(?:base64|utf8|charset=[a-z0-9._-]+))*?,[^\r\n]*$/i;
const RASTER_IMAGE_DATA_URI_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]*={0,2}$/i;
const APP_STATIC_IMAGE_PATH_PATTERN =
  /^\/static\/app\/splunk-cisco-dashboards\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/;

/**
 * Return a safe, normalized image source, or undefined for unsupported input.
 * Network URLs, protocol-relative URLs, non-image data URIs, and oversized
 * values are intentionally rejected.
 */
export const normalizeSharedImageSource = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const source = value.trim();
  if (!source || source.length > MAX_SHARED_IMAGE_SOURCE_BYTES) return undefined;
  return IMAGE_DATA_URI_PATTERN.test(source) || APP_STATIC_IMAGE_PATH_PATTERN.test(source)
    ? source
    : undefined;
};

/**
 * Normalize a persisted Dashboard Builder background. Existing factory
 * backgrounds may include SVG, but new uploads are restricted below to raster
 * formats so uploaded active SVG content cannot become shared configuration.
 */
export const normalizeDashboardBackgroundSource = (
  value: unknown,
): string | undefined => {
  if (typeof value !== "string") return undefined;
  const source = value.trim();
  if (!source || source.length > MAX_DASHBOARD_BACKGROUND_SOURCE_BYTES) {
    return undefined;
  }
  return IMAGE_DATA_URI_PATTERN.test(source) ? source : undefined;
};

/** Return whether a newly uploaded background is a bounded raster data URI. */
export const isAllowedDashboardBackgroundUpload = (value: unknown): boolean => {
  const source = normalizeDashboardBackgroundSource(value);
  return Boolean(source && RASTER_IMAGE_DATA_URI_PATTERN.test(source));
};

/** Check browser-provided metadata before FileReader expands a user upload. */
export const isAllowedDashboardBackgroundFile = (
  mimeType: unknown,
  byteSize: unknown,
): boolean =>
  typeof mimeType === "string" &&
  /^(?:image\/(?:png|jpeg|gif|webp))$/i.test(mimeType) &&
  typeof byteSize === "number" &&
  Number.isFinite(byteSize) &&
  byteSize > 0 &&
  byteSize <= MAX_DASHBOARD_BACKGROUND_UPLOAD_BYTES;
