import { DC_SCOPE_MARKER, normalizeDcScopeValue } from './dcNetworkingScope';
/** Scope-safe models for DC inventory and reported endpoint evidence. */
export type DcTopologyRow = Record<string, unknown>;
export const dcText = (value: unknown): string => typeof value === 'string' ? value : '';
export const dcScopeKey = (row: DcTopologyRow): string => JSON.stringify(
    ['Product', 'Account', 'Controller', 'Fabric', 'FabricId'].map(key => dcText(row[key]))
);
export const dcPhysicalLink = (row: DcTopologyRow): boolean =>
    row.EvidenceType === 'Reported physical connection' &&
    Boolean(dcText(row.LocalPort).trim() && dcText(row.RemotePort).trim());

export function dcLinkGroups(rows: DcTopologyRow[]) {
    const grouped = new Map<string, { id: string; row: DcTopologyRow; links: DcTopologyRow[] }>();
    rows.forEach(row => {
        if (!dcText(row.Local).trim() || !dcText(row.Remote).trim()) {return;}
        const id = dcScopeKey(row);
        if (!grouped.has(id)) {grouped.set(id, { id, row, links: [] });}
        grouped.get(id)?.links.push(row);
    });
    return [...grouped.values()].sort((a,b) =>
        Number(b.links.some(dcPhysicalLink)) - Number(a.links.some(dcPhysicalLink)) || a.id.localeCompare(b.id)
    );
}

export function dcEndpointDiagram(rows: DcTopologyRow[]) {
    // A bounded view of reported endpoints. Positions imply no tier, location,
    // traffic direction, inferred adjacency or unreported intermediate hop.
    const links = rows.slice(0, 6);
    const names = [...new Set(links.flatMap(row => [dcText(row.Local), dcText(row.Remote)]))];
    const nodes = names.map((name,index) => ({ name,
        x: 320 + 230*Math.cos(index*2*Math.PI/Math.max(names.length,1)-Math.PI/2),
        y: 240 + 180*Math.sin(index*2*Math.PI/Math.max(names.length,1)-Math.PI/2),
    }));
    const byName = new Map(nodes.map(node => [node.name,node]));
    return { nodes, links: links.map(row => ({ row,
        source: byName.get(dcText(row.Local))!, target: byName.get(dcText(row.Remote))!,
        physical: dcPhysicalLink(row),
    })) };
}

/** Exact scope before aggregation; never infer cross-controller relationships. */
export function applyDcFabricScope(search: string, row?: DcTopologyRow): string {
    if (!row || !search.includes(DC_SCOPE_MARKER)) {return search;}
    const clauses = ['Product','Account','Controller','Fabric','FabricId'].flatMap(field => {
        if (field==='FabricId' && row[field]==='Unreported') {return [];}
        const value=normalizeDcScopeValue(row[field]);
        return value ? [`lower(${field})=${JSON.stringify(value)}`] : [];
    });
    return clauses.length ? search.replace(DC_SCOPE_MARKER, `${DC_SCOPE_MARKER}\n| where ${clauses.join(' AND ')}`) : search;
}

export const dcLinkKey = (row: DcTopologyRow): string => JSON.stringify([
    dcScopeKey(row), row.LinkId, row.Local, row.LocalPort, row.Remote, row.RemotePort, row.EvidenceType,
]);
