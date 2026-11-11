import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from 'recharts';
import TimeRangeDropdown from '@splunk/react-time-range/Dropdown';
import {useTimeParser} from './useTimeParser';
import {runManagedSearch} from '@/common/services/splunkSearchService';
import {splunkSearchAppUrl} from '@/common/lib/splunkSearchUrl';
import {WorkspaceModalShell} from '@/common/components/workspace/WorkspaceModalShell';
import {useExportPage} from '@/common/hooks/useExportPage';
import {startSectionSearch} from '../expandable_search_example/lifecycle';
import {catalogue,createSearchGate,initialTab,metricValue,numberValue,panelQuery,type Panel,type Row,type Scope} from './model';
const gate=createSearchGate(3);
const panelById=catalogue.panels as Record<string,Panel>;
const button='rounded border sui-border-weak px-3 py-2 sui-bg-section sui-color-active';
const tooltipStyle={backgroundColor:'var(--sui-background-section, #131a23)',color:'var(--sui-content-color, #ecf0f5)',borderColor:'var(--sui-border, #475569)'};
const colors=['#649ef5','#4cbf7f','#f0c243','#bc8aff','#ff8b6a','#00bceb','#ea5b9b'];
const presets=[{label:'4h',earliest:'-4h',latest:'now'},{label:'24h',earliest:'-24h@h',latest:'now'},{label:'48h',earliest:'-48h',latest:'now'},{label:'7d',earliest:'-7d@d',latest:'now'},{label:'30d',earliest:'-30d@d',latest:'now'}];

function Results({panel,rows,onIssue}:{panel:Panel;rows:Row[];onIssue:(issue:string)=>void}) {
    const [table,setTable]=useState(panel.type==='splunk.table');
    const [sort,setSort]=useState({key:'',descending:false});
    const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!k.startsWith('_')||k==='_time');
    if(!rows.length)return <p>No observations in this window. Missing data is unknown.</p>;
    if(panel.type.includes('singlevalue')) {
        const n=metricValue(panel,rows);const first=metricValue(panel,[rows[0]]);
        const trend=rows.map((row,i)=>({index:i,value:metricValue(panel,[row])}));
        return <><strong className="block py-5 text-4xl">{n===null?'—':n.toLocaleString(undefined,{maximumFractionDigits:2})}{n!==null?panel.unit:''}</strong>
            {rows.length>1&&<div style={{height:70}}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><Line dataKey="value" stroke="#649ef5" dot={false} connectNulls={false}/><Tooltip contentStyle={tooltipStyle}/></LineChart></ResponsiveContainer></div>}
            {rows.length>1&&n!==null&&first!==null&&<p className="text-sm">Change from first observation: {(n-first).toLocaleString(undefined,{maximumFractionDigits:2})} {panel.unit==='%'?'percentage points':panel.unit}</p>}</>;
    }
    const ordered=sort.key?[...rows].sort((a,b)=>{const x=numberValue(a[sort.key]),y=numberValue(b[sort.key]);const result=x!==null&&y!==null?x-y:String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),undefined,{numeric:true});return sort.descending?-result:result;}):rows;
    const label=columns.includes('_time')?'_time':columns.find(k=>rows.some(r=>numberValue(r[k])===null))??columns[0];
    const numeric=columns.filter(k=>k!==label&&rows.some(r=>numberValue(r[k])!==null));
    const health=numeric.filter(k=>/health|threshold|percent|_pct/i.test(k)&&!/^Healthy$/i.test(k));
    const measurement=numeric.filter(k=>health.includes(k)||/onboarding|duration|\(ms\)|session-hours/i.test(k));
    const data=rows.map(r=>Object.fromEntries(columns.map(k=>{const n=numberValue(r[k]);return [k,numeric.includes(k)?(health.includes(k)&&(n===null||n<0||n>100)?null:n):String(r[k]??'—')];})));
    const timeline=label==='_time';
    const axes=<><CartesianGrid stroke="var(--sui-border)" strokeDasharray="3 3"/><XAxis dataKey={label} tick={{fontSize:11}} minTickGap={35}/><YAxis yAxisId="count" tick={{fontSize:11}}/>{measurement.length>0&&<YAxis yAxisId="health" orientation="right" domain={measurement.every(k=>health.includes(k))?[0,100]:[0,'auto']} tick={{fontSize:11}}/>}<Tooltip contentStyle={tooltipStyle}/><Legend/></>;
    return <>
        <div className="my-3 flex flex-wrap gap-2">
            <button className={button} onClick={()=>setTable(v=>!v)}>{table?'Show chart':'Show data'}</button>
            <button className={button} onClick={()=>{
                const csv=[columns,...rows.map(r=>columns.map(k=>r[k]??''))].map(row=>row.map(v=>{let s=String(v);if(typeof v!=='number'&&/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
                const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='catalyst-results.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
            }}>Download CSV</button>
        </div>
        {!table&&numeric.length>0?<div style={{height:320}}><ResponsiveContainer width="100%" height="100%">{timeline?<LineChart data={data}>{axes}{numeric.map((key,i)=><Line key={key} dataKey={key} yAxisId={measurement.includes(key)?'health':'count'} stroke={colors[i%colors.length]} dot={false} connectNulls={false}/>)}</LineChart>:<BarChart data={data}>{axes}{numeric.map((key,i)=><Bar key={key} dataKey={key} yAxisId={measurement.includes(key)?'health':'count'} fill={colors[i%colors.length]}/>)}</BarChart>}</ResponsiveContainer></div>:
            <div className="max-h-[480px] overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{columns.map(k=><th className="border-b sui-border-weak p-2" key={k} aria-sort={sort.key===k?(sort.descending?'descending':'ascending'):'none'}><button onClick={()=>setSort(v=>({key:k,descending:v.key===k?!v.descending:false}))}>{k}{sort.key===k?(sort.descending?' ↓':' ↑'):''}</button></th>)}</tr></thead><tbody>{ordered.map((r,i)=><tr key={i}>{columns.map(k=><td className="border-b sui-border-weak p-2" key={k}>{(k==='Issue'||k==='IssueName')&&r[k]?<button className="underline" onClick={()=>onIssue(String(r[k]))}>{String(r[k])}</button>:String(r[k]??'—')}</td>)}</tr>)}</tbody></table></div>}
    </>;
}
export function PanelView({id,scope,refresh,onIssue}:{id:string;scope:Scope;refresh:number;onIssue:(s:string)=>void}) {
    const panel=panelById[id];let query;try {query=panelQuery(panel,scope);}catch {query={spl:'',earliest:scope.earliest,latest:scope.latest};}
    const [state,setState]=useState<{rows:Row[];status:string;loading:boolean;limited:boolean}>({rows:[],status:'Waiting for search…',loading:true,limited:false});
    useEffect(()=>{
        if(!query.spl){setState({rows:[],status:'Unsupported filter characters. Change the filter and try again.',loading:false,limited:false});return;}
        setState({rows:[],status:'Waiting for search…',loading:true,limited:false});
        return startSectionSearch({onStart(){},run:(signal)=>gate(signal,async()=>{
            const response=await runManagedSearch({spl:query.spl,earliestTime:query.earliest,latestTime:query.latest,appContext:'splunk-cisco-dashboards',count:501,maxTimeSeconds:60,signal,tag:'catalyst:'+id});
            if(response.timedOut)throw new Error('Search timed out; partial results omitted');return response.results as Row[];
        }),onResult:rows=>setState({rows:rows.slice(0,500),status:'',loading:false,limited:rows.length>500}),onError:()=>setState({rows:[],status:'Search unavailable or timed out. Open in Search to investigate; partial results are not shown.',loading:false,limited:false})});
    },[query.spl,query.earliest,query.latest,refresh,id]);
    return <article className="min-w-0 rounded border sui-border-weak sui-bg-section p-4"><h3 className="text-lg font-semibold">{panel.title}</h3><p className="my-2 text-sm">{panel.description}</p>
        {query.spl&&<a className="text-sm underline" href={splunkSearchAppUrl(query.spl,{earliest:query.earliest,latest:query.latest},'splunk-cisco-dashboards')} target="_blank" rel="noopener noreferrer">Open in Search</a>}
        {(query.earliest!==scope.earliest||query.latest!==scope.latest)&&<p className="text-xs">Fixed comparison window: {query.earliest} → {query.latest}</p>}
        <p role="status" className="my-2 text-sm">{state.status}</p>
        {!state.loading&&!state.status&&<Results panel={panel} rows={state.rows} onIssue={onIssue}/>}
        {state.limited&&<p role="status">Showing the first 500 rows. Open in Search for the complete result.</p>}
    </article>;
}
export function Section({group,scope,refresh,onIssue}:{group:{id:string;title:string;panels:string[]};scope:Scope;refresh:number;onIssue:(s:string)=>void}) {
    const [open,setOpen]=useState(false);
    return <section className="my-4 rounded border sui-border-weak p-4"><button className="flex w-full justify-between text-left text-lg font-semibold" aria-expanded={open} aria-controls={group.id} onClick={()=>setOpen(v=>!v)}><span>{group.title}</span><span aria-hidden>{open?'−':'+'}</span></button>
        {!open&&<p className="mt-2 text-sm">Open to load these details.</p>}
        <div id={group.id} hidden={!open}>{open&&<div className="mt-4 grid gap-4 lg:grid-cols-2">{group.panels.map(id=><PanelView key={id} id={id} scope={scope} refresh={refresh} onIssue={onIssue}/>)}</div>}</div>
    </section>;
}
export default function CatalystOperations() {
    const parser=useTimeParser();
    const params=useMemo(()=>new URLSearchParams(window.location.search),[]);
    const [tab,setTab]=useState(()=>initialTab(params.get('tab')));
    const [range,setRange]=useState({earliest:params.get('form.time_tok.earliest')??'-24h@h',latest:params.get('form.time_tok.latest')??'now'});
    const [site,setSite]=useState(params.get('form.site_tok')??'*'),[clientType,setClientType]=useState(params.get('form.client_type_tok')??'*');
    const [draftSite,setDraftSite]=useState(site);const [issue,setIssue]=useState(params.get('form.selected_issue')??'');const [refresh,setRefresh]=useState(0);const [interval,setIntervalValue]=useState(()=>{const n=parseInt(params.get('form.refresh_tok')??'0',10);return [60,300,900].includes(n)?n:0;});const [closed,setClosed]=useState(0);
    const page=useRef<HTMLDivElement|null>(null);const {exporting,exportAs,error:exportError}=useExportPage({targetRef:page,fileName:'catalyst-operations'});
    const selected=catalogue.tabs.find(t=>t.id===tab)!;const scope={...range,site,clientType,issue};
    const showIssue=useCallback((s:string)=>setIssue(s),[]);
    useEffect(()=>{if(!interval)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setRefresh(v=>v+1);},interval*1000);return()=>window.clearInterval(timer);},[interval]);
    useEffect(()=>{const url=new URL(window.location.href);url.searchParams.set('tab',tab);url.searchParams.set('form.time_tok.earliest',range.earliest);url.searchParams.set('form.time_tok.latest',range.latest);url.searchParams.set('form.site_tok',site);url.searchParams.set('form.client_type_tok',clientType);url.searchParams.set('form.refresh_tok',interval?interval+'s':'off');if(issue)url.searchParams.set('form.selected_issue',issue);else {url.searchParams.delete('form.selected_issue');url.searchParams.delete('form.selected_issue_priority');}window.history.replaceState(null,'',url);},[tab,range,site,clientType,interval,issue]);
    return <main ref={page} className="min-h-screen sui-bg-page sui-color-active p-6"><div className="mx-auto max-w-[1600px]">
        <h1 className="text-2xl font-bold">Catalyst Operations (Preview)</h1><p className="my-3">Preview—try this dashboard and let us know what works, what’s confusing, or what’s missing.</p>
        <p className="mb-4 text-sm">Headlines cover the selected time window. Detailed sections load only when opened. Closing sections or changing tabs requests cancellation of their active searches. Reopening loads fresh results.</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">{presets.map(p=><button key={p.label} className={button} aria-pressed={range.earliest===p.earliest&&range.latest===p.latest} style={range.earliest===p.earliest?{backgroundColor:'#049fd9',color:'#ecf0f5'}:undefined} onClick={()=>setRange({earliest:p.earliest,latest:p.latest})}>{p.label}</button>)}
            <TimeRangeDropdown aria-label="Advanced time range" earliest={range.earliest} latest={range.latest} onChange={(_e:unknown,r?:{earliest:string;latest:string})=>setRange(current=>({earliest:r?.earliest??current.earliest,latest:r?.latest??current.latest}))} onRequestParseEarliest={parser.handleRequestParseEarliest} onRequestParseLatest={parser.handleRequestParseLatest} parseEarliest={parser.parseEarliest} parseLatest={parser.parseLatest} realTimeDisabled/>
            <button className={button} onClick={()=>setRefresh(v=>v+1)}>Refresh visible panels</button><label>Auto refresh <select className={button} value={interval} onChange={e=>setIntervalValue(Number(e.target.value))}><option value={0}>Off</option><option value={60}>60 seconds</option><option value={300}>5 minutes</option><option value={900}>15 minutes</option></select></label>
            <button className={button} onClick={()=>{setClosed(v=>v+1);setIssue('');}}>Close all details</button><button className={button} disabled={exporting} onClick={()=>exportAs('png')}>Export image</button>
        </div>
        {exportError&&<p role="alert">{exportError}</p>}
        <form className="mb-4 flex flex-wrap items-center gap-2" onSubmit={e=>{e.preventDefault();setSite(draftSite||'*');}}><label>Detail site <input className={button} maxLength={128} value={draftSite} onChange={e=>setDraftSite(e.target.value)}/></label><button className={button} type="submit">Apply site</button><label>Detail client type <select className={button} value={clientType} onChange={e=>setClientType(e.target.value)}><option value="*">All</option><option>Wired</option><option>Wireless</option></select></label></form>
        <p className="mb-4 text-sm">Detail site/type apply to the filtered client OS, location, client-detail and onboarding panels. All other panels retain their reported all-site scope. Weekly comparisons keep their labeled fixed windows. Missing data is unknown; percentages describe reported measurements, not service availability.</p>
        <div role="tablist" aria-label="Catalyst dashboard tabs" className="mb-4 flex flex-wrap gap-2">{catalogue.tabs.map(t=><button key={t.id} id={'tab-'+t.id} role="tab" aria-selected={t.id===tab} aria-controls={'page-'+t.id} className={button} style={t.id===tab?{backgroundColor:'#049fd9',color:'#ecf0f5'}:undefined} onClick={()=>{setTab(t.id);setIssue('');}}>{t.label}</button>)}</div>
        <div key={tab} role="tabpanel" id={'page-'+tab} aria-labelledby={'tab-'+tab}>
            <div className="grid gap-4 lg:grid-cols-3">{selected.core.map(id=><PanelView key={id} id={id} scope={scope} refresh={refresh} onIssue={showIssue}/>)}</div>
            <div key={closed}>{selected.groups.map(group=><Section key={group.id} group={group} scope={scope} refresh={refresh} onIssue={showIssue}/>)}</div>
        </div>
        {issue&&<WorkspaceModalShell variant="detail" title="Issue detail" onClose={()=>setIssue('')}><PanelView id="operations_viz_ex_issue_detail_modal" scope={scope} refresh={refresh} onIssue={showIssue}/></WorkspaceModalShell>}
    </div></main>;
}
