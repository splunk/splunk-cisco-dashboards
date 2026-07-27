const VERSION_PATTERN =
  /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

type ParsedAppVersion = {
  core: number[];
  prerelease: string[];
};

type VersionComparison = -1 | 0 | 1 | null;

function normalizeVersion(value: unknown): string {
  return String(value || "").trim();
}

function parseAppVersion(value: unknown): ParsedAppVersion | null {
  const normalized = normalizeVersion(value);
  const match = normalized.match(VERSION_PATTERN);
  if (!match) return null;

  return {
    core: match[1].split(".").map(Number),
    prerelease: match[2] ? match[2].split(".") : [],
  };
}

function comparePrerelease(left: string[], right: string[]): -1 | 0 | 1 {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftIsNumeric = /^\d+$/.test(leftPart);
    const rightIsNumeric = /^\d+$/.test(rightPart);
    if (leftIsNumeric && rightIsNumeric) {
      return Number(leftPart) > Number(rightPart) ? 1 : -1;
    }
    if (leftIsNumeric) return -1;
    if (rightIsNumeric) return 1;
    return leftPart > rightPart ? 1 : -1;
  }

  return 0;
}

/**
 * Compare dotted app versions using SemVer ordering.
 *
 * Returns 1 when left is newer, -1 when right is newer, 0 when they
 * are equivalent, and null when either value cannot be compared safely.
 */
export function compareAppVersions(
  left: unknown,
  right: unknown,
): VersionComparison {
  const leftVersion = parseAppVersion(left);
  const rightVersion = parseAppVersion(right);
  if (!leftVersion || !rightVersion) return null;

  const length = Math.max(leftVersion.core.length, rightVersion.core.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.core[index] || 0;
    const rightPart = rightVersion.core[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

/**
 * Splunk's `update.version` is the latest version it knows about on
 * Splunkbase, not proof that the installed app needs an update. Expose the
 * candidate only when it is provably newer; malformed versions fail closed.
 */
export function resolveAppVersions({
  installedVersion,
  updateVersion,
}: {
  installedVersion?: unknown;
  updateVersion?: unknown;
} = {}): { version: string; updateVersion: string } {
  const installed = normalizeVersion(installedVersion);
  const candidate = normalizeVersion(updateVersion);
  const updateComparison = installed
    ? compareAppVersions(candidate, installed)
    : null;

  return {
    version: installed,
    updateVersion:
      updateComparison !== null && updateComparison > 0 ? candidate : "",
  };
}
