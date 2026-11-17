import type { MetricOverride } from "@/common/hooks/usePersistedMetricOverrides";

const WORKSPACE_VIZ_TYPES = new Set([
  'area', 'line', 'column', 'bar', 'singlevalue', 'table',
  'barbreakdown', 'pie', 'singlevalueradial', 'fillergauge', 'markergauge',
]);

/** Validate persisted shared choices and canonicalize keys for conflict checks. */
export const parseWorkspaceVisualizations = (raw: unknown): Record<string, string> => {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [id, viz] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).slice(0, 256)) {
    if (/^[a-z0-9_]{1,128}$/.test(id) && typeof viz === 'string' && WORKSPACE_VIZ_TYPES.has(viz) && !['__proto__', 'constructor', 'prototype'].includes(id)) result[id] = viz;
  }
  return result;
};

export const resolveWorkspaceVisualization = (
  personal: MetricOverride | undefined,
  shared: string | undefined,
): MetricOverride | undefined => {
  const sharedViz = shared && WORKSPACE_VIZ_TYPES.has(shared) ? shared as MetricOverride['vizOverride'] : undefined;
  if (personal?.vizOverride || !sharedViz) return personal;
  return {...personal, vizOverride: sharedViz};
};
