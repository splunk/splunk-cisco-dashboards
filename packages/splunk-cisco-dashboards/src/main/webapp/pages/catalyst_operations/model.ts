import definitions from './sourceDefinitions.json';
import catalogue from './catalogue.json';
export {catalogue};
export type Row = Record<string, unknown>;
export type Scope = {earliest: string; latest: string; site: string; clientType: string; issue: string};
export type Panel = typeof catalogue.panels[keyof typeof catalogue.panels];
type Source = {type: string; options: {query: string; extend?: string; queryParameters?: {earliest?: string; latest?: string}}};
const sources = definitions as unknown as Record<string,{dataSources:Record<string,Source>}>;
const quoteValue = (s: string) => {if (s.length>2048 || /[`$]/.test(s)) throw new Error('Macros and tokens are not allowed in filter values');return s.replace(/[\r\n]/g,' ').replace(/[\\"]/g,'\\$&');};
export function panelQuery(panel: Panel, scope: Scope) {
    const library = sources[panel.source].dataSources;
    const tokens: Record<string,string> = {site_tok:quoteValue(scope.site),client_type_tok:quoteValue(scope.clientType),selected_issue:quoteValue(scope.issue)};
    function resolve(id: string, seen: string[] = []): {spl:string; earliest:string; latest:string} {
        if (seen.includes(id) || !library[id]) throw new Error('Invalid source dependency');
        const s=library[id];
        const parent=s.type==='ds.chain'?resolve(s.options.extend!,[...seen,id]):null;
        const params=s.options.queryParameters;
        return {spl:(parent?parent.spl+'\n':'')+s.options.query,
            earliest:params?.earliest && !params.earliest.includes('$')?params.earliest:parent?.earliest??scope.earliest,
            latest:params?.latest && !params.latest.includes('$')?params.latest:parent?.latest??scope.latest};
    }
    const q=resolve(panel.sourceId);
    q.spl=q.spl.replace(/\$([\w.]+)\$/g,(_all,key:string)=>{if(!(key in tokens))throw new Error('Unbound search token');return tokens[key];});
    if (/(?:^|\|)\s*(?:collect|outputlookup|delete|sendemail|noop)\b/i.test(q.spl)) throw new Error('Unsupported search command');
    return q;
}
export function numberValue(value: unknown): number|null {
    if (value==null || String(value).trim()==='') return null;
    const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:null;
}
export function metricValue(panel: Panel, rows: Row[]) {
    const row=rows[rows.length-1];if(!row)return null;
    const match=panel.value.match(/seriesByName\(['"]([^'"]+)['"]\)/);
    const field=match?.[1]??Object.keys(row).find(k=>k!=='_time'&&numberValue(row[k])!==null);
    const value=field?numberValue(row[field]):null;
    if(value===null||value<0||(panel.unit==='%'&&value>100))return null;
    return value;
}
export function initialTab(value: string|null) {
    return ({layout_overview:'overview',layout_exec:'executive',layout_client:'client',overview:'overview',executive:'executive',client:'client'} as Record<string,string>)[value??'']??'overview';
}
// One budget across every open section; queued work is discarded if its section closes.
export function createSearchGate(limit: number) {
    let running=0;
    const queue:Array<()=>void>=[];
    const drain=()=>{while(running<limit&&queue.length)queue.shift()!();};
    return function schedule<T>(signal:AbortSignal,run:()=>Promise<T>):Promise<T> {
        return new Promise((resolve,reject)=>{
            const start=()=>{
                signal.removeEventListener('abort',abort);
                if(signal.aborted){reject(new Error('Search closed'));return;}
                running++;
                Promise.resolve().then(()=>{if(signal.aborted)throw new Error('Search closed');return run();}).then(resolve,reject).finally(()=>{running--;drain();});
            };
            const abort=()=>{const i=queue.indexOf(start);if(i>=0){queue.splice(i,1);reject(new Error('Search closed'));}};
            if(signal.aborted){reject(new Error('Search closed'));return;}
            queue.push(start);signal.addEventListener('abort',abort,{once:true});drain();
        });
    };
}
