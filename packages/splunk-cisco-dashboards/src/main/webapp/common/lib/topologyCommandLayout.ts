import type { TopologySite } from '@/common/types';

/** Fit a few disconnected fabrics as equal peers, without implying a hub. */
export const isolatedFabricLayout = (
    sites: readonly Pick<TopologySite, 'id' | 'role'>[],
    linkCount: number,
    wide: boolean,
): { viewBox: string; points: Map<string, { x: number; y: number }> } | null => {
    if (linkCount || sites.length === 0 || sites.length > 3 || sites.some(site => site.role !== 'fabric')) return null;
    const points = new Map<string, { x: number; y: number }>();
    sites.forEach((site, index) => {
        const offset = index - (sites.length - 1) / 2;
        points.set(site.id, wide ? { x: 500 + offset * 250, y: 310 } : { x: 500, y: 310 + offset * 145 });
    });
    const width = wide ? Math.max(300, sites.length * 250) : 300;
    const height = wide ? 200 : sites.length * 145 + 80;
    return { viewBox: `${500 - width / 2} ${310 - height / 2} ${width} ${height}`, points };
};
