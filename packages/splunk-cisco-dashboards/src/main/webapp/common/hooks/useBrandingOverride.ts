/**
 * useBrandingOverride — per-deployment editable title / subtitle / logo
 * for the Overview page header, mirrored to localStorage.
 *
 * Customers want to change the header chrome without redeploying the
 * Splunk app or editing workspace configuration files. This hook stores three
 * optional override fields:
 *
 *   • title       — overrides the configured workspace title
 *   • subtitle    — overrides the hardcoded "Splunk Secure Networking Essentials"
 *   • logoDataUri — overrides the built-in default header logo.
 *                   Stored as a `data:` URI (the editor uses
 *                   FileReader to encode the uploaded image), so the
 *                   logo travels with the user's browser profile and
 *                   doesn't require swapping a file in the Splunk app
 *                   directory.
 *
 * Storage shape (versioned for future migrations):
 *
 *   {
 *     v: 1,
 *     title: "Acme Corp",
 *     subtitle: "Operations Center",
 *     logoDataUri: "data:image/png;base64,..."
 *   }
 *
 * Empty / missing fields fall through to the workspace configuration
 * (workspace title/label, configured subtitle, and packaged logo). That
 * means an operator who only wants to change the
 * subtitle leaves title and logo as-is.
 *
 * Logo size cap: 256 KB on the data-URI string. A data URI is
 * ~33% larger than the underlying binary, so 256 KB ≈ 192 KB of
 * image data — way more than a 36×36 header icon needs, but
 * generous enough that we accept reasonable PNGs without resampling.
 * Anything larger is rejected by `setOverride` so the caller can
 * surface a friendly error in the editor UI.
 */

import { useCallback, useEffect, useState } from "react";
import {
  EXECUTIVE_WORKSPACE_SOURCE_ID,
  readUserScopedStorageItem,
  workspaceStorageKey,
  type WorkspaceId,
} from "@/common/config/insightsWorkspaces";

const STORAGE_KEY = "splunk-cisco-dashboards.branding.v1";
const STORAGE_VERSION = 1;

/**
 * Cap on the persisted `logoDataUri` string length. 256 KiB is well
 * within typical localStorage budgets (5-10 MB per origin in
 * mainstream browsers) while comfortably accommodating the kind of
 * PNG / SVG operators upload for a 36×36 header logo.
 */
export const BRANDING_LOGO_DATA_URI_MAX_BYTES = 256 * 1024;

/**
 * MIME types accepted by the editor's file input. Restricted to the
 * common web-safe image formats: PNG covers most logos, SVG keeps
 * vector files crisp at any zoom level, JPEG handles the rare
 * photo-style brand mark, WEBP is the modern compressed format,
 * and GIF stays for legacy compatibility.
 *
 * Anything outside this set is rejected up-front by the `accept`
 * attribute on the input plus the runtime `type.startsWith('image/')`
 * guard in `readImageAsDataUri` below — we'd rather refuse a file
 * than persist a `data:application/x-msdownload;base64,…` payload
 * by accident.
 */
export const BRANDING_ACCEPTED_LOGO_MIME_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export interface BrandingOverride {
  title?: string;
  subtitle?: string;
  logoDataUri?: string;
}

interface PersistedShape {
  v: number;
  title?: string;
  subtitle?: string;
  logoDataUri?: string;
}

const EMPTY_OVERRIDE: BrandingOverride = Object.freeze({});

const sanitizeString = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const sanitizeLogoDataUri = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  if (!raw.startsWith("data:image/")) return undefined;
  if (raw.length > BRANDING_LOGO_DATA_URI_MAX_BYTES) return undefined;
  return raw;
};

const normalize = (
  raw: BrandingOverride | undefined | null,
): BrandingOverride => {
  if (!raw) return EMPTY_OVERRIDE;
  const out: BrandingOverride = {};
  const t = sanitizeString(raw.title);
  if (t) out.title = t;
  const s = sanitizeString(raw.subtitle);
  if (s) out.subtitle = s;
  const l = sanitizeLogoDataUri(raw.logoDataUri);
  if (l) out.logoDataUri = l;
  return out;
};

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
  workspaceStorageKey(STORAGE_KEY, workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID);

const readFromStorage = (storageKey: string): BrandingOverride => {
  if (typeof window === "undefined" || !window.localStorage)
    return EMPTY_OVERRIDE;
  try {
    const raw = readUserScopedStorageItem(storageKey);
    if (!raw) return EMPTY_OVERRIDE;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (!parsed || parsed.v !== STORAGE_VERSION) return EMPTY_OVERRIDE;
    return normalize({
      title: parsed.title,
      subtitle: parsed.subtitle,
      logoDataUri: parsed.logoDataUri,
    });
  } catch {
    return EMPTY_OVERRIDE;
  }
};

const writeToStorage = (
  storageKey: string,
  override: BrandingOverride,
): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (!override.title && !override.subtitle && !override.logoDataUri) {
      // Nothing to persist — wipe the key so a future migration
      // doesn't see an empty {v:1} object and have to special-case
      // it. Mirrors how the metric-overrides hook handles the
      // "all defaults" state.
      window.localStorage.removeItem(storageKey);
      return;
    }
    const payload: PersistedShape = { v: STORAGE_VERSION, ...override };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Storage unavailable (private mode / quota). The override is
    // still active for the session; we just can't persist.
  }
};

export interface UseBrandingOverrideResult {
  /**
   * Current override. Always normalised: empty/whitespace strings are
   * stripped, oversized logo URIs are dropped. Use the `??` operator
   * with the in-component defaults to render the effective values.
   */
  override: BrandingOverride;
  /**
   * Replace the override wholesale. Pass `{}` to clear all fields.
   * Returns `false` if the supplied override is invalid (e.g. the
   * logo data URI exceeds the size cap), in which case nothing is
   * persisted and the existing override is preserved.
   */
  setOverride: (next: BrandingOverride) => boolean;
  /** Wipe the override entirely (storage key removed). */
  resetAll: () => void;
}

export const useBrandingOverride = (
  workspaceId: WorkspaceId = EXECUTIVE_WORKSPACE_SOURCE_ID,
): UseBrandingOverrideResult => {
  const storageKey = storageKeyForWorkspace(workspaceId);
  const [override, setOverrideState] = useState<BrandingOverride>(() =>
    readFromStorage(storageKey),
  );

  // Cross-tab sync: pick up changes made in another tab via the
  // standard `storage` event so the header stays consistent across
  // multiple Splunk Web tabs the user may have open.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      setOverrideState(readFromStorage(storageKey));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const setOverride = useCallback(
    (next: BrandingOverride): boolean => {
      // Validate logo size BEFORE normalising so the caller can tell
      // an "intentionally too big" upload (return false → editor
      // shows error) apart from a silently-stripped trim/whitespace
      // (return true, normalised override has fewer fields than the
      // input).
      if (
        typeof next.logoDataUri === "string" &&
        next.logoDataUri.length > BRANDING_LOGO_DATA_URI_MAX_BYTES
      ) {
        return false;
      }
      const normalised = normalize(next);
      setOverrideState(normalised);
      writeToStorage(storageKey, normalised);
      return true;
    },
    [storageKey],
  );

  const resetAll = useCallback(() => {
    setOverrideState(EMPTY_OVERRIDE);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore — in-memory state is still reset for the session
      }
    }
  }, [storageKey]);

  return { override, setOverride, resetAll };
};

/**
 * Read an `<input type="file">` File as a `data:` URI. Resolves with
 * the encoded string on success, rejects with an Error otherwise. The
 * editor UI calls this from the file-input change handler so the
 * uploaded image becomes a self-contained string we can hand to
 * `setOverride`.
 *
 * Caller is responsible for size checks against
 * `BRANDING_LOGO_DATA_URI_MAX_BYTES` after resolving — this helper
 * stays I/O-only so the validation rules can evolve without churning
 * the FileReader plumbing.
 */
export const readImageAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selected file is not an image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read image (unexpected result type)."));
        return;
      }
      if (!result.startsWith("data:image/")) {
        reject(new Error("Decoded payload is not an image data URI."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
