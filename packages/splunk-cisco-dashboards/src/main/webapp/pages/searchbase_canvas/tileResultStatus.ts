import type { NoDataReason } from '@/common/hooks/useMetric';

export type TileResultFilter =
    | 'all'
    | 'needs_attention'
    | 'failed'
    | 'working';

export type TileResultStatus =
    | 'needs_attention'
    | 'failed'
    | 'working'
    | 'unobserved';

export const isSearchFailureReason = (
    reason: NoDataReason | undefined
): boolean =>
    reason === 'dispatch_failed' ||
    reason === 'capacity_limited' ||
    reason === 'job_failed' ||
    reason === 'error';

export const tileResultStatusForNoDataReason = (
    reason: NoDataReason
): Extract<TileResultStatus, 'needs_attention' | 'failed'> =>
    isSearchFailureReason(reason) ? 'failed' : 'needs_attention';

export const tileResultFilterIsVisible = (
    filter: TileResultFilter,
    failedCount: number
): boolean => filter !== 'failed' || failedCount > 0;
