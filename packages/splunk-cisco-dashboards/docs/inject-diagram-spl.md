# Injecting Diagrams via SPL

The Network Diagram page reads from `network_diagrams.csv` — a
flat lookup with one row per saved diagram. Because the lookup is
just a CSV, you can write a Splunk search that builds a diagram
payload and lands it directly into the lookup, bypassing the
React UI. Operators see the diagram appear in the "Open"
dropdown the next time they refresh the page.

## Schema reminder

```
name,updated_at,updated_by,payload_json
```

- `name` — friendly identifier (`^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$`).
- `updated_at` — ISO-8601 timestamp.
- `updated_by` — free-form attribution string (e.g. `spl-script`).
- `payload_json` — the diagram itself as a single JSON blob.

## Payload shape

```json
{
  "version": 1,
  "title": {
    "text": "Auto-seeded topology",
    "x": 40,
    "y": 40,
    "fontSize": 28,
    "color": "#0369a1",
    "bold": true
  },
  "nodes": [
    {
      "id": "core-01",
      "type": "device:router",
      "x": 40,
      "y": 200,
      "label": "core-01",
      "shortLabel": "core-01",
      "assetId": "core-01"
    },
    {
      "id": "edge-01",
      "type": "device:switch",
      "x": 280,
      "y": 200,
      "label": "edge-01",
      "shortLabel": "edge-01",
      "assetId": "edge-01"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "sourceId": "core-01",
      "targetId": "edge-01",
      "kind": "physical",
      "direction": "forward",
      "animationColor": "#0ea5e9"
    }
  ],
  "groups": []
}
```

Field-level docs live in
[`diagramPersistenceService.ts`](../src/main/webapp/common/services/diagramPersistenceService.ts).
Anything you omit gets a sensible default at hydrate time.

## Recipe 1: minimal hand-rolled diagram

Drop two devices and a directional edge into a fresh diagram
called `demo-from-spl`. Safe to re-run: it upserts by `name`.

```spl
| makeresults
| eval name = "demo-from-spl",
       updated_at = strftime(now(), "%Y-%m-%dT%H:%M:%SZ"),
       updated_by = "spl-script",
       payload_json = "{\"version\":1,\"title\":{\"text\":\"Hello SPL\",\"x\":40,\"y\":40,\"fontSize\":28,\"color\":\"#0369a1\",\"bold\":true},\"nodes\":[{\"id\":\"core-01\",\"type\":\"device:router\",\"x\":40,\"y\":200,\"label\":\"core-01\",\"shortLabel\":\"core-01\",\"assetId\":\"core-01\"},{\"id\":\"edge-01\",\"type\":\"device:switch\",\"x\":280,\"y\":200,\"label\":\"edge-01\",\"shortLabel\":\"edge-01\",\"assetId\":\"edge-01\"}],\"edges\":[{\"id\":\"e1\",\"sourceId\":\"core-01\",\"targetId\":\"edge-01\",\"kind\":\"physical\",\"direction\":\"forward\",\"animationColor\":\"#0ea5e9\"}],\"groups\":[]}"
| append [
    | inputlookup network_diagrams
    | where name != "demo-from-spl"
  ]
| sort name
| table name updated_at updated_by payload_json
| outputlookup network_diagrams.csv
```

The `append [| inputlookup … | where name != "demo-from-spl"]`
pattern is the same upsert idiom the React UI uses — keep all
existing rows except the one we're replacing, then write the
combined set back.

## Recipe 2: auto-build from `asset_inventory`

Generate a diagram seeded from the live device fleet — a 4-wide
grid of the first N devices, no edges (the operator wires those
up afterwards). Useful as a starting point for a customer
walkthrough.

```spl
| inputlookup asset_inventory.csv
| head 24
| streamstats count as idx
| eval x = (idx - 1) % 4 * 220,
       y = floor((idx - 1) / 4) * 180,
       device_type_lc = lower(coalesce(device_type, "generic")),
       node = "{\"id\":\"" . device_name
              . "\",\"type\":\"device:" . device_type_lc
              . "\",\"x\":" . x
              . ",\"y\":" . y
              . ",\"label\":\"" . device_name
              . "\",\"shortLabel\":\"" . device_name
              . "\",\"assetId\":\"" . device_name . "\"}"
| stats list(node) as node_list
| eval payload_json = "{\"version\":1,\"title\":{\"text\":\"Auto fleet seed\",\"x\":40,\"y\":-40,\"fontSize\":28,\"color\":\"#0f172a\",\"bold\":true},\"nodes\":["
       . mvjoin(node_list, ",")
       . "],\"edges\":[],\"groups\":[]}"
| eval name = "auto-fleet-" . strftime(now(), "%Y%m%d"),
       updated_at = strftime(now(), "%Y-%m-%dT%H:%M:%SZ"),
       updated_by = "spl-auto"
| table name updated_at updated_by payload_json
| append [
    | inputlookup network_diagrams
    | where name != "auto-fleet-" . strftime(now(), "%Y%m%d")
  ]
| sort name
| outputlookup network_diagrams.csv
```

Caveats:

- `device_type` from `asset_inventory.csv` must match a known
  shape id (`switch`, `l3_switch`, `router`, `firewall`, `wlc`,
  `access_point`, `server`, `cloud`, `generic`). Anything else
  hydrates as a generic shape — no error, just a less-specific
  icon.
- The diagram canvas auto-fits on hydration, so the absolute
  `x` / `y` values are just relative seed positions; operators
  can re-arrange after opening.
- `assetId` is what binds the rendered node to the live
  `asset_inventory` row for status overlays. Set it on every
  node you want bound to live data.

## Recipe 3: scheduled job to keep a diagram current

Save Recipe 2 as a scheduled search that runs daily. Each run
overwrites the `auto-fleet-YYYYMMDD` diagram for the current
day, so operators always have a "today's snapshot" available
in the dropdown without anyone clicking anything.

`savedsearches.conf`:

```ini
[Auto-seed daily fleet diagram]
search = << recipe 2 SPL above >>
cron_schedule = 30 5 * * *
dispatch.earliest_time = -24h
dispatch.latest_time = now
enableSched = 1
```

## Validation

After running the SPL, confirm the row landed:

```spl
| inputlookup network_diagrams
| where name = "demo-from-spl"
| eval payload_size_bytes = len(payload_json)
| table name updated_at updated_by payload_size_bytes
```

The Network Diagram page caps `payload_json` at 256 KiB; if your
seed payload is larger you'll get a friendly error on save.
That cap is enforced in the React layer only — `outputlookup`
will happily write any size, but the browser refuses to send
the upsert SPL when the operator clicks Save.

## Removing a seeded diagram

```spl
| inputlookup network_diagrams
| where name != "demo-from-spl"
| outputlookup network_diagrams.csv
```
