# Claude Code Handoff - splunk-cisco-dashboards

Date: 2026-07-06
Repo: `/Users/akhamis/repo/splunk-cisco-dashboards`
Branch: `dashboard_updates`
Latest commit at handoff: `7850478 Centralize overview tile metadata in searchbase`
Working tree before this handoff file was created: clean

## Context

This repo contains the Splunk Cisco Dashboards app. The recent work focused on making the Executive Overview page rely on `searchbase.conf` as the central source of truth for factory/default tile metadata and runtime SPL dispatch.

The user strongly wants `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf` to be the central DB for search metadata. Avoid adding hardcoded search names, search display names, tile labels, value fields, thresholds, or factory bindings directly in React where `searchbase.conf` can own them.

## Most Recent Commit

Commit:

```text
7850478 Centralize overview tile metadata in searchbase
```

Validated before commit:

```sh
yarn --cwd packages/splunk-cisco-dashboards typecheck
git diff --check
```

The commit touched:

```text
packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf
packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx
packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/FloridaMap.tsx
packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/IncidentTicker.tsx
packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/edgeFetchers.ts
packages/splunk-cisco-dashboards/src/main/webapp/common/hooks/useMetric.ts
packages/splunk-cisco-dashboards/src/main/webapp/common/hooks/usePersistedSectionTileCounts.ts
packages/splunk-cisco-dashboards/src/main/webapp/common/types.ts
packages/splunk-cisco-dashboards/src/main/webapp/pages/executive_insights/index.tsx
```

## Key Decisions

1. `searchbase.conf` is authoritative for Overview factory tile metadata.
2. `insights_workspaces.conf` defines workspace metadata plus shared tile order and visible counts. Search binding metadata remains in `searchbase.conf`.
3. Overview factory tiles should run literal SPL from `searchbase.conf` with the stanza's `dispatch_context`.
4. The Overview factory path should not fall back to `| savedsearch "..."` for searchbase-only stanzas.
5. New `viz_options` keys added to `searchbase.conf` are app-specific JSON metadata, not native Dashboard Studio options.

App-specific `viz_options` metadata currently includes:

```json
{
  "overview": [
    {
      "tileId": "network_health",
      "section": "it_health",
      "label": "Network health",
      "valueField": "score"
    }
  ],
  "mapFooter": {
    "slot": "primary",
    "id": "map_inter_site_latency"
  },
  "topologyMap": {
    "role": "teA2AInventory"
  },
  "topologySite": {
    "id": "aub"
  }
}
```

## Important Implementation Notes

### Overview factory tiles

`packages/splunk-cisco-dashboards/src/main/webapp/pages/executive_insights/index.tsx`

The old hardcoded `METRIC_CONFIG` fallback catalogue was removed. This matters: the user noticed labels like `label: 'Critical sites available'` still existed in the React file and correctly called out that this violated the central-source rule.

Now:

- `buildOverviewMetricConfig(searchbaseRecords)` builds tiles from `viz_options.overview`.
- The page does not carry a parallel tile metadata catalogue.
- Until the searchbase catalogue loads, the tile roster is empty instead of using hardcoded metadata.
- `buildOverviewMapFooterConfig(searchbaseRecords)` builds the map footer cards from `viz_options.mapFooter`.
- The tiny disabled map-footer config exists only to keep hooks stable while metadata loads. It is not rendered.

### Dispatch context

Overview tiles must honor `dispatch_context`. Some stanzas dispatch in apps like `cisco-catalyst-app`, not `splunk-cisco-dashboards`.

Do not regress this by running all searches in the current app context.

### Map / ThousandEyes

The active editable map is `CustomerTopologyMap`.

The ThousandEyes A2A inventory lookup no longer hardcodes the friendly search name `Overview - Link ThousandEyes A2A Inventory`. It resolves via:

```json
{"topologyMap":{"role":"teA2AInventory"}}
```

`edgeFetchers.ts` was also updated to use the same role-based metadata lookup.

Legacy `FloridaMap.tsx` now resolves site search bindings through `viz_options.topologySite.id` and no longer falls back to savedsearch-command dispatch.

## Validation Snippet Used

This was used to confirm the Overview factory config and searchbase metadata match:

```sh
node - <<'NODE'
const fs=require('fs');
const readConf=(path)=>{const text=fs.readFileSync(path,'utf8'); const stanzas={}; let cur=null; for(const raw of text.split(/\r?\n/)){const line=raw.trim(); const m=line.match(/^\[([^\]]+)\]$/); if(m){cur=m[1]; stanzas[cur]={}; continue;} if(!cur||!line||line.startsWith('#')) continue; const i=raw.indexOf('='); if(i>=0) stanzas[cur][raw.slice(0,i).trim()]=raw.slice(i+1).trim();} return stanzas;};
const searchbase=readConf('packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf');
const factory=readConf('packages/splunk-cisco-dashboards/src/main/resources/splunk/default/insights_workspaces.conf');
const overview=[]; const mapFooter=[]; const bad=[];
for (const [id, stanza] of Object.entries(searchbase)) {
  if (!stanza.viz_options) continue;
  try {
    const v=JSON.parse(stanza.viz_options);
    if (Array.isArray(v.overview)) for (const item of v.overview) overview.push({id, tileId:item.tileId, section:item.section});
    else if (v.overview && typeof v.overview==='object') overview.push({id, tileId:v.overview.tileId, section:v.overview.section});
    if (v.mapFooter) mapFooter.push({id, slot:v.mapFooter.slot, footerId:v.mapFooter.id});
  } catch(e) { bad.push({id,error:e.message}); }
}
const factoryIds=new Set();
for (const stanza of Object.values(factory)) {
  for (const id of String(stanza.tiles||'').split(',').map(s=>s.trim()).filter(Boolean)) factoryIds.add(id);
}
const overviewIds=new Set(overview.map(x=>x.tileId));
const missing=[...factoryIds].filter(id=>!overviewIds.has(id));
const orphan=[...overviewIds].filter(id=>!factoryIds.has(id));
const duplicateOverview=Object.entries(overview.reduce((acc,x)=>{acc[x.tileId]=(acc[x.tileId]||0)+1;return acc;},{})).filter(([,n])=>n>1);
console.log(JSON.stringify({factoryIds:factoryIds.size,overviewIds:overviewIds.size,missing,orphan,duplicateOverview,bad,mapFooter}, null, 2));
if (missing.length || orphan.length || bad.length || duplicateOverview.length || mapFooter.length !== 2 || mapFooter.some(x=>!x.footerId)) process.exitCode=1;
NODE
```

Expected result at commit `7850478`:

```json
{
  "factoryIds": 36,
  "overviewIds": 36,
  "missing": [],
  "orphan": [],
  "duplicateOverview": [],
  "bad": [],
  "mapFooter": [
    {
      "id": "overview_inter_site_latency",
      "slot": "primary",
      "footerId": "map_inter_site_latency"
    },
    {
      "id": "it_critical_systems_site_link_availability_pct_trend",
      "slot": "secondary",
      "footerId": "map_site_link_availability"
    }
  ]
}
```

## Caveats / Things Not To Accidentally Revert

- There are still generic saved-search helpers elsewhere in the app, including dashboard builder, searchbase canvas, and generic metric hooks. Those were intentionally not removed because they support real saved searches and legacy flows outside the Overview factory path.
- The user specifically objected to Overview factory/default tiles being hardcoded or savedsearch-command driven. Keep that path searchbase-centered.
- The custom `viz_options.overview`, `mapFooter`, `topologyMap`, and `topologySite` keys are not Dashboard Studio native. They are SCD React metadata.
- If you add new Insights tiles, add the search metadata to `searchbase.conf` and the tile ID/order to the matching `layout.<workspace>.<section>` stanza in `insights_workspaces.conf`.
- If a default tile is missing from the page, check both `viz_options.overview` and `insights_workspaces.conf`.

## User Preferences / Standing Direction

- Use `scd_summariesonly`, not `summariesonly`.
- Avoid `sort` in `searchbase.conf` unless the logic truly requires it.
- `local.meta` must never reside in the project and should be removed before packaging.
- Be careful with `dispatch_context`; it matters for data model searches.
- Do not deploy or update Splunk unless explicitly asked. The user will run install/build when needed.
- Commit only when asked.

## Helpful Commands

```sh
git status --short
yarn --cwd packages/splunk-cisco-dashboards typecheck
git diff --check
SPLUNK_HOME=/opt/10 ./build.sh --fast --install
```

## Suggested Next Checks

1. Re-open the Overview page after install and confirm no factory tile dispatches `| savedsearch`.
2. Confirm Open in Search works for tiles with no returned data.
3. Confirm map footer cards render from `searchbase.conf` metadata.
4. Confirm searches with `dispatch_context = cisco-catalyst-app` execute in that app context.
5. Confirm no factory Overview labels remain duplicated in `pages/executive_insights/index.tsx`.
