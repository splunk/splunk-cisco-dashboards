import React, { useMemo, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import Select from '@splunk/react-ui/Select';
import { useTableData, type TimeRange, type TableDataResult } from '@/common/hooks/useMetric';
import { dcEndpointDiagram, dcLinkGroups, dcLinkKey, dcScopeKey, dcText, type DcTopologyRow } from '@/common/lib/dcFabricTopology';
import { formatPlainMetricNumber, toFiniteMetricNumber } from '@/common/lib/metricValueFormat';

interface Props {
    queries: { inventory?: string; links?: string; shared?: string };
    range: TimeRange;
    refreshToken: number;
    table?: boolean;
    onOpenSearch: (id: string, scope?: DcTopologyRow) => void;
}
const scopeLabel = (row: DcTopologyRow) =>
    [row.Product, row.Account, row.Controller, row.Fabric, row.FabricId === 'Unreported' ? '' : row.FabricId].filter(Boolean).join(' / ');
const details: Record<string,string> = { 'Nexus Dashboard':'nd_fabrics', ACI:'aci_health', 'Nexus 9000':'nexus_resources', 'MDS / NDFC':'san_health', 'Nexus Hyperfabric':'hf_nodes' };
const measured = (value: unknown) => {
    const number = toFiniteMetricNumber(typeof value === 'number' ? value : dcText(value));
    return number === null ? 'Not reported' : formatPlainMetricNumber(number);
};
const availability = (result: TableDataResult, query?: string) => {
    if (!query) {return 'Waiting for the DC search library.';}
    if (result.source === 'loading') {return 'Loading observations for the selected time…';}
    if (result.noDataReason === 'capacity_limited') {return 'Search slots are busy. Refresh after searches finish.';}
    if (result.failureMessage || ['dispatch_failed','job_failed','error'].includes(result.noDataReason || '')) {return 'The evidence search failed. Open Search for details or refresh.';}
    if (!result.rows.length) {return 'No qualifying observations in this time window. Relationship and health are unknown.';}
    return '';
};

export default function DcFabricTopology({ queries, range, refreshToken, table=false, onOpenSearch }: Props) {
    const [tab,setTab] = useState<'links'|'fabrics'|'shared'>('links');
    const [selected,setSelected] = useState('');
    const [searchError,setSearchError] = useState('');
    const open = (id: string, scope?: DcTopologyRow) => {
        try { setSearchError(''); onOpenSearch(id,scope); }
        catch (error) { setSearchError(error instanceof Error ? error.message : 'Could not open the evidence search.'); }
    };
    const configs = useMemo(() => ({
        inventory: {id:'dc_workspace_fabric_inventory',spl:queries.inventory},
        links: {id:'dc_workspace_fabric_links',spl:queries.links},
        shared: {id:'dc_workspace_inventory_matches',spl:queries.shared},
    }),[queries.inventory,queries.links,queries.shared]);
    const options = {dispatchContext:'splunk-cisco-dashboards',dispatchPriority:2,rowLimit:1000,suppressMockOnEmpty:true};
    const inventory = useTableData({...options,...configs.inventory},range,refreshToken);
    const links = useTableData({...options,...configs.links},range,refreshToken);
    const shared = useTableData({...options,...configs.shared},range,refreshToken);
    const groups = useMemo(() => dcLinkGroups(links.rows),[links.rows]);
    const group = groups.find(item => item.id===selected) || groups[0];
    const diagram = useMemo(() => dcEndpointDiagram(group?.links || []),[group]);
    const views = {
        links: { active: links, query: queries.links, searchId: 'fabric_links' },
        fabrics: { active: inventory, query: queries.inventory, searchId: 'fabric_inventory' },
        shared: { active: shared, query: queries.shared, searchId: 'inventory_matches' },
    };
    const {active, query, searchId} = views[tab];
    const state = availability(active,query);
    const openGroup = (row: DcTopologyRow) => open('fabric_links',row);
    return <section aria-label="DC fabric evidence" className="flex flex-col gap-3 sui-color-default">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Evidence view">
            {([['links','Reported links'],['fabrics','Fabrics'],['shared','Shared inventory']] as const).map(([id,label]) =>
                <Button key={id} appearance={tab===id?'primary':'secondary'} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</Button>)}
        </div>
        <p className="text-xs sui-color-muted">Lab observations · {range.label}. Layout shows reported relationships, not geography or traffic direction. Missing data stays unknown.</p>
        <Button appearance="secondary" disabled={!query} onClick={()=>open(searchId)}>Open this evidence in Search</Button>
        {searchError && <p role="alert" className="sui-color-negative">{searchError}</p>}
        {state ? <p role="status" className="p-4 text-sm sui-color-muted">{state}</p> : <>
            {tab==='links' && (group ? <>
                <Select value={group.id} onChange={(_event,{value})=>setSelected(String(value))} labelText="Reported fabric / controller">
                    {groups.map(item=><Select.Option key={item.id} value={item.id} label={scopeLabel(item.row)} />)}
                </Select>
                <p className="text-xs sui-color-default">Solid blue: reported physical connection with both ports. Dashed amber: reported topology. No measured traffic path is established.</p>
                {!table && <svg viewBox="0 0 640 480" style={{width:'100%',maxHeight:440}} role="img" aria-label={`Reported endpoint diagram for ${scopeLabel(group.row)}`}>
                    {diagram.links.map(({row,source,target,physical})=><line key={dcLinkKey(row)} x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                        stroke={physical?'var(--sui-content-info, #649ef5)':'var(--sui-content-warning, #f0c243)'} strokeWidth={physical?2.5:1.5} strokeDasharray={physical?undefined:'6 5'}>
                        <title>{`${row.Local} ${row.LocalPort || ''} ↔ ${row.Remote} ${row.RemotePort || ''}: ${row.EvidenceType}`}</title>
                    </line>)}
                    {diagram.nodes.map(node=><g key={node.name}>
                        <rect x={node.x-56} y={node.y-17} width={112} height={34} rx={6} fill="var(--sui-background-popup, #25272a)" stroke="var(--sui-content-info, #649ef5)" />
                        <text x={node.x} y={node.y+4} textAnchor="middle" style={{fontSize:11,fill:'var(--sui-content-active, #f2f4f8)'}}>{node.name.length>16?`${node.name.slice(0,15)}…`:node.name}</text>
                        <title>{node.name}</title>
                    </g>)}
                </svg>}
                <p className="text-xs sui-color-muted">Showing {diagram.links.length} of {group.links.length} loaded link records for this fabric. Endpoint positions do not imply spine/leaf roles.</p>
                <div className="overflow-auto" style={{maxHeight:260}}>
                    <table className="w-full text-xs"><caption className="text-left">Endpoint and port evidence</caption><thead><tr>{['Local','Remote','Evidence','Age (min)'].map(label=><th key={label} className="text-left p-2">{label}</th>)}</tr></thead><tbody>
                        {(table?group.links:group.links.slice(0,12)).map((row)=><tr key={dcLinkKey(row)} className="border-b sui-border-weak">
                            <td className="p-2">{dcText(row.Local)}<br/>{dcText(row.LocalPort) || 'Port not reported'}</td>
                            <td className="p-2">{dcText(row.Remote)}<br/>{dcText(row.RemotePort) || 'Port not reported'}</td>
                            <td className="p-2">{dcText(row.EvidenceType)}</td><td className="p-2">{measured(row.AgeMinutes)}</td>
                        </tr>)}
                    </tbody></table>
                </div>
                <Button onClick={()=>openGroup(group.row)}>Investigate this fabric in Search</Button>
            </> : <p role="status">No reported links with both named endpoints. Open Search to inspect incomplete records.</p>)}
            {tab==='fabrics' && <div className="flex flex-col gap-3" style={{maxHeight:620,overflowY:'auto'}}>
                {['Nexus Dashboard','ACI','Nexus 9000','MDS / NDFC','Nexus Hyperfabric'].map(product=><section key={product} className="rounded border sui-border-default p-3">
                    <h3 className="font-bold sui-color-active">{product}</h3>
                    {!inventory.rows.some(row=>row.Product===product) && <p className="text-xs">No inventory observed in this window; other product measurements may still be available.</p>}
                    {inventory.rows.filter(row=>row.Product===product).map(row=><div key={dcScopeKey(row)} className="my-2 rounded border sui-border-weak p-2 sui-bg-popup">
                        <p className="font-bold text-sm">{row.Fabric==='Unreported'?'Fabric not reported':dcText(row.Fabric)}</p>
                        <p className="text-xs break-all">{dcText(row.Account)} · {dcText(row.Controller)}{row.FabricId!=='Unreported'?` · ${dcText(row.FabricId)}`:''}</p>
                        <p className="text-xs">Devices observed: {measured(row.Devices)} · Latest observation: {measured(row.AgeMinutes)} min ago</p>
                        <Button appearance="secondary" onClick={()=>open(details[product],row)}>Open product details in Search</Button>
                    </div>)}
                </section>)}
            </div>}
            {tab==='shared' && <div className="flex flex-col gap-3" style={{maxHeight:620,overflowY:'auto'}}>
                <p className="text-xs">Exact serial identity across products. These are inventory matches, not physical connections or traffic paths.</p>
                {shared.rows.map(row=><div key={dcText(row.Serial)} className="rounded border sui-border-weak p-3">
                    <p className="font-bold">Serial {dcText(row.Serial)}</p>
                    <p className="text-sm">{(Array.isArray(row.Products)?row.Products:[row.Products]).map(String).join(' ↔ ')}</p>
                    <p className="text-xs">{(Array.isArray(row.Devices)?row.Devices:[row.Devices]).filter(Boolean).map(String).join(', ')}</p>
                </div>)}
            </div>}
        </>}
        <p className="text-xs sui-color-muted">Each evidence search loads at most 1,000 rows. Open Search for the full result and raw fields.</p>
    </section>;
}
