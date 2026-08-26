/**
 * Normalization for image sources that can come from shared app configuration.
 *
 * Shared content must not cause every viewer's browser to fetch an arbitrary
 * network or local URL. Self-contained image data and this app's static image
 * paths are the two supported source classes.
 */

export const MAX_SHARED_IMAGE_SOURCE_BYTES = 256 * 1024;

const IMAGE_DATA_URI_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;(?:base64|utf8|charset=[a-z0-9._-]+))*?,[^\r\n]*$/i;
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
