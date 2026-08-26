const THOUSAND_EYES_APP_HOST = "app.thousandeyes.com";

export const THOUSAND_EYES_APP_URL = `https://${THOUSAND_EYES_APP_HOST}/`;

/**
 * Keep telemetry-provided permalinks from becoming an arbitrary navigation
 * sink. ThousandEyes publishes its application links on this HTTPS origin;
 * malformed, non-HTTPS, and lookalike-host URLs are deliberately ignored.
 */
export const normalizeThousandEyesLink = (
  value: unknown,
): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== THOUSAND_EYES_APP_HOST
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
};

export const buildThousandEyesTestLink = (
  teTestId?: string,
): string | undefined => {
  if (!teTestId) return undefined;
  return `${THOUSAND_EYES_APP_URL}network-app-synthetics/views/?testId=${encodeURIComponent(
    teTestId,
  )}`;
};
